"use client";

import {
  Account,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";

import type { Credential, ContractSnapshot, WriteResult } from "../types";
import { getNetworkConfig, signAndSubmitTransaction } from "./stellar";

const { rpcUrl, networkPassphrase } = getNetworkConfig();
const sorobanServer = new SorobanRpc.Server(rpcUrl);
const readOnlySource = Keypair.random().publicKey();

function getContractId(): string {
  const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID?.trim();

  if (!contractId) {
    throw new Error(
      "NEXT_PUBLIC_CONTRACT_ID is missing. Deploy the contract to Stellar Testnet and add it to frontend/.env.local.",
    );
  }

  return contractId;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeValue(entry),
      ]),
    );
  }

  return value;
}

function toAddressString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "address" in value) {
    return String((value as { address: unknown }).address);
  }

  return String(value);
}

function toCredential(value: unknown): Credential {
  const normalized = normalizeValue(value) as Record<string, unknown>;

  return {
    id: Number(normalized.id),
    admin: toAddressString(normalized.admin),
    student: toAddressString(normalized.student),
    studentName: String(normalized.student_name ?? ""),
    course: String(normalized.course ?? ""),
    issueDate: String(normalized.issue_date ?? ""),
    issuedAtLedger: Number(normalized.issued_at_ledger ?? 0),
  };
}

function extractSimulationResult(simulation: unknown): unknown {
  const typedSimulation = simulation as {
    error?: string;
    result?: { retval?: xdr.ScVal; xdr?: string };
    results?: Array<{ retval?: xdr.ScVal; xdr?: string }>;
    restorePreamble?: unknown;
  };

  if (typedSimulation.error) {
    throw new Error(typedSimulation.error);
  }

  if (typedSimulation.restorePreamble) {
    throw new Error(
      "The contract footprint needs restoration before it can be used. Restore the contract state and try again.",
    );
  }

  const result = typedSimulation.result || typedSimulation.results?.[0];

  if (!result) {
    return null;
  }

  if (result.retval) {
    return normalizeValue(scValToNative(result.retval));
  }

  if (result.xdr) {
    return normalizeValue(scValToNative(xdr.ScVal.fromXDR(result.xdr, "base64")));
  }

  return null;
}

function buildInvokeOperation(method: string, args: xdr.ScVal[]) {
  return Operation.invokeContractFunction({
    contract: getContractId(),
    function: method,
    args,
  });
}

async function simulateRead(method: string, args: xdr.ScVal[] = []) {
  const sourceAccount = new Account(readOnlySource, "0");
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(buildInvokeOperation(method, args))
    .setTimeout(30)
    .build();

  const simulation = await sorobanServer.simulateTransaction(transaction);

  return extractSimulationResult(simulation);
}

async function simulateAndSendWrite(
  sourcePublicKey: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<WriteResult> {
  const sourceAccount = await sorobanServer.getAccount(sourcePublicKey);
  const transaction = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(buildInvokeOperation(method, args))
    .setTimeout(30)
    .build();

  const simulation = await sorobanServer.simulateTransaction(transaction);
  const simulatedResult = extractSimulationResult(simulation);
  const assembled = SorobanRpc.assembleTransaction(transaction, simulation).build();
  const submission = await signAndSubmitTransaction(assembled.toXDR());

  return {
    hash: submission.hash,
    result: simulatedResult,
  };
}

export async function isInitialized(): Promise<boolean> {
  return Boolean(await simulateRead("is_initialized"));
}

export async function getAdmin(): Promise<string> {
  return toAddressString(await simulateRead("get_admin"));
}

export async function getInstitution(): Promise<string> {
  return String(await simulateRead("get_institution"));
}

export async function getTotalCredentials(): Promise<number> {
  return Number(await simulateRead("total_credentials"));
}

export async function getCredential(credentialId: number): Promise<Credential> {
  const result = await simulateRead("get_credential", [
    nativeToScVal(BigInt(credentialId), { type: "u64" }),
  ]);

  return toCredential(result);
}

export async function getStudentCredentials(student: string): Promise<number[]> {
  const result = (await simulateRead("get_student_credentials", [
    nativeToScVal(student, { type: "address" }),
  ])) as unknown[];

  return (result || []).map((value) => Number(value));
}

export async function getStudentCredentialDetails(
  student: string,
): Promise<Credential[]> {
  const result = (await simulateRead("get_student_credential_details", [
    nativeToScVal(student, { type: "address" }),
  ])) as unknown[];

  return (result || []).map((entry) => toCredential(entry));
}

export async function hasCredential(
  student: string,
  course: string,
): Promise<boolean> {
  return Boolean(
    await simulateRead("has_credential", [
      nativeToScVal(student, { type: "address" }),
      nativeToScVal(course),
    ]),
  );
}

export async function initializeContract(
  sourcePublicKey: string,
  institution: string,
): Promise<WriteResult> {
  return simulateAndSendWrite(sourcePublicKey, "init", [
    nativeToScVal(sourcePublicKey, { type: "address" }),
    nativeToScVal(institution),
  ]);
}

export async function mintCredential(
  sourcePublicKey: string,
  student: string,
  studentName: string,
  course: string,
  issueDate: string,
): Promise<WriteResult> {
  return simulateAndSendWrite(sourcePublicKey, "mint", [
    nativeToScVal(student, { type: "address" }),
    nativeToScVal(studentName),
    nativeToScVal(course),
    nativeToScVal(issueDate),
  ]);
}

export async function getContractSnapshot(): Promise<ContractSnapshot> {
  const initialized = await isInitialized();

  if (!initialized) {
    return {
      isInitialized: false,
      admin: null,
      institution: null,
      totalCredentials: 0,
    };
  }

  const [admin, institution, totalCredentials] = await Promise.all([
    getAdmin(),
    getInstitution(),
    getTotalCredentials(),
  ]);

  return {
    isInitialized: true,
    admin,
    institution,
    totalCredentials,
  };
}
