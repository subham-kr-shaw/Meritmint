"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  getContractSnapshot,
  getCredential,
  getStudentCredentialDetails,
  getStudentCredentials,
  initializeContract,
  mintCredential,
} from "../lib/contract";
import type { Credential, ContractSnapshot } from "../types";

interface MainFeatureProps {
  publicKey: string | null;
}

type ActionState = {
  loading: boolean;
  error: string | null;
};

type ActionName =
  | "refresh"
  | "bootstrap"
  | "mint"
  | "walletLookup"
  | "proofLookup"
  | "copy";

const emptyActionState: Record<ActionName, ActionState> = {
  refresh: { loading: false, error: null },
  bootstrap: { loading: false, error: null },
  mint: { loading: false, error: null },
  walletLookup: { loading: false, error: null },
  proofLookup: { loading: false, error: null },
  copy: { loading: false, error: null },
};

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 break-all text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function CredentialCard({
  credential,
  onCopy,
  highlighted = false,
}: {
  credential: Credential;
  highlighted?: boolean;
  onCopy: (credentialId: number) => Promise<void>;
}) {
  return (
    <article
      className={`rounded-3xl border p-5 transition ${
        highlighted
          ? "border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(103,232,249,0.2)]"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">
              Credential #{credential.id}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">
              {credential.studentName}
            </h3>
            <p className="text-sm text-slate-300">{credential.course}</p>
          </div>

          <dl className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Student Wallet</dt>
              <dd className="break-all text-slate-200">{credential.student}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Institution Admin</dt>
              <dd className="break-all text-slate-200">{credential.admin}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Issue Date</dt>
              <dd className="text-slate-200">{credential.issueDate}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Ledger</dt>
              <dd className="text-slate-200">{credential.issuedAtLedger}</dd>
            </div>
          </dl>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onCopy(credential.id)}
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-200"
          >
            Copy Proof Link
          </button>
        </div>
      </div>
    </article>
  );
}

export default function MainFeature({ publicKey }: MainFeatureProps) {
  const searchParams = useSearchParams();
  const proofParam = searchParams.get("credential") || "";

  const [mode, setMode] = useState<"admin" | "student">("student");
  const [snapshot, setSnapshot] = useState<ContractSnapshot | null>(null);
  const [actions, setActions] =
    useState<Record<ActionName, ActionState>>(emptyActionState);
  const [notice, setNotice] = useState<string | null>(null);
  const [bootstrapInstitution, setBootstrapInstitution] =
    useState("MeritMint Academy");
  const [lookupWallet, setLookupWallet] = useState("");
  const [proofCredentialId, setProofCredentialId] = useState(proofParam);
  const [studentCredentials, setStudentCredentials] = useState<Credential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(
    null,
  );
  const [mintForm, setMintForm] = useState({
    student: "",
    studentName: "",
    course: "",
    issueDate: new Date().toISOString().slice(0, 10),
  });

  const isAdmin = useMemo(
    () => Boolean(publicKey && snapshot?.admin && publicKey === snapshot.admin),
    [publicKey, snapshot?.admin],
  );

  const setActionState = (
    name: ActionName,
    loading: boolean,
    error: string | null = null,
  ) => {
    setActions((current) => ({
      ...current,
      [name]: { loading, error },
    }));
  };

  const buildProofUrl = (credentialId: number) => {
    if (typeof window === "undefined") {
      return `/?credential=${credentialId}`;
    }

    return `${window.location.origin}/?credential=${credentialId}`;
  };

  const refreshSnapshot = async () => {
    setActionState("refresh", true, null);

    try {
      const nextSnapshot = await getContractSnapshot();
      setSnapshot(nextSnapshot);
    } catch (refreshError) {
      setActionState(
        "refresh",
        false,
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to load contract state.",
      );
      return;
    }

    setActionState("refresh", false, null);
  };

  const loadStudentWallet = async (wallet: string) => {
    setActionState("walletLookup", true, null);
    setNotice(null);

    try {
      const [credentialIds, credentials] = await Promise.all([
        getStudentCredentials(wallet),
        getStudentCredentialDetails(wallet),
      ]);

      setStudentCredentials(credentials);

      if (credentialIds.length === 0) {
        setNotice("No credentials found for that student wallet yet.");
      } else {
        setNotice(
          `Loaded ${credentialIds.length} credential${
            credentialIds.length === 1 ? "" : "s"
          } for ${wallet}.`,
        );
      }
    } catch (walletError) {
      setActionState(
        "walletLookup",
        false,
        walletError instanceof Error
          ? walletError.message
          : "Unable to load student credentials.",
      );
      return;
    }

    setActionState("walletLookup", false, null);
  };

  const loadProofCredential = async (credentialId: string) => {
    if (!credentialId) {
      setActionState("proofLookup", false, "Enter a credential ID first.");
      return;
    }

    setActionState("proofLookup", true, null);
    setNotice(null);

    try {
      const credential = await getCredential(Number(credentialId));
      setSelectedCredential(credential);
      setNotice(`Proof verified for credential #${credential.id}.`);
    } catch (proofError) {
      setActionState(
        "proofLookup",
        false,
        proofError instanceof Error
          ? proofError.message
          : "Unable to load credential proof.",
      );
      return;
    }

    setActionState("proofLookup", false, null);
  };

  const copyProofLink = async (credentialId: number) => {
    setActionState("copy", true, null);

    try {
      await navigator.clipboard.writeText(buildProofUrl(credentialId));
      setNotice(`Copied proof link for credential #${credentialId}.`);
    } catch (copyError) {
      setActionState(
        "copy",
        false,
        copyError instanceof Error
          ? copyError.message
          : "Unable to copy proof link.",
      );
      return;
    }

    setActionState("copy", false, null);
  };

  const handleBootstrap = async () => {
    if (!publicKey) {
      setActionState("bootstrap", false, "Connect the institution wallet first.");
      return;
    }

    setActionState("bootstrap", true, null);
    setNotice(null);

    try {
      const result = await initializeContract(publicKey, bootstrapInstitution);
      setNotice(
        `Contract initialized on Stellar Testnet. Transaction hash: ${result.hash}`,
      );
      await refreshSnapshot();
    } catch (bootstrapError) {
      setActionState(
        "bootstrap",
        false,
        bootstrapError instanceof Error
          ? bootstrapError.message
          : "Unable to initialize the contract.",
      );
      return;
    }

    setActionState("bootstrap", false, null);
  };

  const handleMint = async () => {
    if (!publicKey) {
      setActionState("mint", false, "Connect the admin wallet before minting.");
      return;
    }

    setActionState("mint", true, null);
    setNotice(null);

    try {
      const result = await mintCredential(
        publicKey,
        mintForm.student,
        mintForm.studentName,
        mintForm.course,
        mintForm.issueDate,
      );
      const credentialId = Number(result.result);

      setNotice(
        `Credential #${credentialId} minted successfully. Proof link: ${buildProofUrl(
          credentialId,
        )}`,
      );
      setMintForm((current) => ({
        ...current,
        student: "",
        studentName: "",
        course: "",
      }));
      await refreshSnapshot();

      if (lookupWallet === mintForm.student) {
        await loadStudentWallet(lookupWallet);
      }

      if (proofCredentialId === String(credentialId)) {
        await loadProofCredential(String(credentialId));
      }
    } catch (mintError) {
      setActionState(
        "mint",
        false,
        mintError instanceof Error ? mintError.message : "Minting failed.",
      );
      return;
    }

    setActionState("mint", false, null);
  };

  useEffect(() => {
    void refreshSnapshot();
  }, []);

  useEffect(() => {
    if (publicKey) {
      setLookupWallet(publicKey);
    }
  }, [publicKey]);

  useEffect(() => {
    setProofCredentialId(proofParam);
    if (proofParam) {
      void loadProofCredential(proofParam);
    }
  }, [proofParam]);

  return (
    <section className="space-y-8">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 backdrop-blur">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
              Contract Dashboard
            </p>
            <h2 className="text-3xl font-semibold text-white">
              Issue non-transferable academic credentials on Stellar Testnet
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">
              The institution admin mints soulbound certificate records to student
              wallets. Students can inspect their credentials and share a proof
              URL that resolves directly against on-chain Soroban state.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode("student")}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                mode === "student"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/15 text-slate-200 hover:border-cyan-300/60 hover:text-cyan-200"
              }`}
            >
              Student Mode
            </button>
            <button
              type="button"
              onClick={() => setMode("admin")}
              className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                mode === "admin"
                  ? "bg-cyan-400 text-slate-950"
                  : "border border-white/15 text-slate-200 hover:border-cyan-300/60 hover:text-cyan-200"
              }`}
            >
              Admin Mode
            </button>
          </div>
        </div>

        {actions.refresh.error ? (
          <p className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {actions.refresh.error}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Initialization"
          value={
            snapshot?.isInitialized
              ? snapshot.institution || "Initialized"
              : actions.refresh.loading
                ? "Loading..."
                : "Not initialized"
          }
        />
        <StatCard
          label="Admin"
          value={snapshot?.admin || (actions.refresh.loading ? "Loading..." : "Unset")}
        />
        <StatCard
          label="Total Credentials"
          value={snapshot?.totalCredentials ?? (actions.refresh.loading ? "..." : 0)}
        />
      </div>

      {!snapshot?.isInitialized ? (
        <div className="rounded-[2rem] border border-amber-300/20 bg-amber-400/10 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/80">
                Bootstrap Contract
              </p>
              <h3 className="text-2xl font-semibold text-white">
                Initialize MeritMint with your institution wallet
              </h3>
              <p className="max-w-2xl text-sm text-amber-100/85">
                The first connected wallet becomes the on-chain admin after this
                initialization transaction is signed in Freighter.
              </p>
            </div>

            <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
              <input
                value={bootstrapInstitution}
                onChange={(event) => setBootstrapInstitution(event.target.value)}
                placeholder="Institution name"
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-950/70 px-5 py-3 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-300/60"
              />
              <button
                type="button"
                onClick={handleBootstrap}
                disabled={actions.bootstrap.loading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actions.bootstrap.loading ? <Spinner /> : null}
                Initialize
              </button>
            </div>
          </div>

          {actions.bootstrap.error ? (
            <p className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {actions.bootstrap.error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 backdrop-blur">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
              {mode === "admin" ? "Admin Minting" : "Student Wallet Lookup"}
            </p>
            <h3 className="text-2xl font-semibold text-white">
              {mode === "admin"
                ? "Mint a certificate to a student wallet"
                : "View credentials held by any student address"}
            </h3>
          </div>

          {mode === "admin" ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                {isAdmin ? (
                  <p>
                    Connected as the credential issuer. New certificates will be
                    written to Soroban storage and linked to the target student
                    address.
                  </p>
                ) : (
                  <p>
                    The connected wallet is not the current admin. The contract
                    will reject mint attempts unless Freighter is connected with{" "}
                    <span className="break-all text-cyan-200">
                      {snapshot?.admin || "the initialized admin"}
                    </span>
                    .
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={mintForm.student}
                  onChange={(event) =>
                    setMintForm((current) => ({
                      ...current,
                      student: event.target.value,
                    }))
                  }
                  placeholder="Student wallet address"
                  className="rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                />
                <input
                  value={mintForm.studentName}
                  onChange={(event) =>
                    setMintForm((current) => ({
                      ...current,
                      studentName: event.target.value,
                    }))
                  }
                  placeholder="Student full name"
                  className="rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                />
                <input
                  value={mintForm.course}
                  onChange={(event) =>
                    setMintForm((current) => ({
                      ...current,
                      course: event.target.value,
                    }))
                  }
                  placeholder="Course or program"
                  className="rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                />
                <input
                  type="date"
                  value={mintForm.issueDate}
                  onChange={(event) =>
                    setMintForm((current) => ({
                      ...current,
                      issueDate: event.target.value,
                    }))
                  }
                  className="rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                />
              </div>

              <button
                type="button"
                onClick={handleMint}
                disabled={actions.mint.loading || !snapshot?.isInitialized}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {actions.mint.loading ? <Spinner /> : null}
                Mint Credential
              </button>

              {actions.mint.error ? (
                <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {actions.mint.error}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={lookupWallet}
                  onChange={(event) => setLookupWallet(event.target.value)}
                  placeholder="Student wallet address"
                  className="min-w-0 flex-1 rounded-full border border-white/10 bg-slate-900/80 px-5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                />
                <button
                  type="button"
                  onClick={() => void loadStudentWallet(lookupWallet)}
                  disabled={actions.walletLookup.loading || !lookupWallet}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {actions.walletLookup.loading ? <Spinner /> : null}
                  Load Credentials
                </button>
              </div>

              {actions.walletLookup.error ? (
                <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {actions.walletLookup.error}
                </p>
              ) : null}

              <div className="space-y-4">
                {studentCredentials.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                    Load a wallet to see its credential history.
                  </div>
                ) : (
                  studentCredentials.map((credential) => (
                    <CredentialCard
                      key={credential.id}
                      credential={credential}
                      onCopy={copyProofLink}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6 rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 backdrop-blur">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
              Proof Link
            </p>
            <h3 className="text-2xl font-semibold text-white">
              Verify a credential by on-chain ID
            </h3>
            <p className="text-sm text-slate-300">
              Share a link like <span className="text-cyan-200">/?credential=1</span>{" "}
              and MeritMint will load the matching Soroban credential record.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <input
              value={proofCredentialId}
              onChange={(event) => setProofCredentialId(event.target.value)}
              placeholder="Credential ID"
              className="rounded-full border border-white/10 bg-slate-900/80 px-5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
            />
            <button
              type="button"
              onClick={() => void loadProofCredential(proofCredentialId)}
              disabled={actions.proofLookup.loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300/60 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {actions.proofLookup.loading ? <Spinner /> : null}
              Verify Proof
            </button>
          </div>

          {actions.proofLookup.error ? (
            <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {actions.proofLookup.error}
            </p>
          ) : null}

          {selectedCredential ? (
            <CredentialCard
              credential={selectedCredential}
              highlighted
              onCopy={copyProofLink}
            />
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
              Enter a credential ID or open a shared proof link to display the
              credential payload here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
