"use client";

import * as freighterApi from "@stellar/freighter-api";
import { Horizon, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

type FreighterError = { message?: string } | string | undefined;

const TESTNET_NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET;
const TESTNET_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const TESTNET_HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";

function readFreighterError(error: FreighterError): string {
  if (typeof error === "string") {
    return error;
  }

  return error?.message || "Freighter returned an unknown error.";
}

export function getNetworkConfig() {
  return {
    rpcUrl: TESTNET_RPC_URL,
    networkPassphrase: TESTNET_NETWORK_PASSPHRASE,
    horizonUrl: TESTNET_HORIZON_URL,
  };
}

export async function getFreighterPublicKey(): Promise<string> {
  const connection = await freighterApi.isConnected();

  if ("error" in connection && connection.error) {
    throw new Error(readFreighterError(connection.error));
  }

  if (!connection.isConnected) {
    throw new Error(
      "Freighter not found. Install the Freighter browser extension and refresh the page.",
    );
  }

  const publicKeyReader = freighterApi as typeof freighterApi & {
    getPublicKey?: () => Promise<{
      publicKey?: string;
      address?: string;
      error?: FreighterError;
    }>;
  };

  if (!publicKeyReader.getPublicKey) {
    throw new Error(
      "This Freighter API version does not expose getPublicKey(). Update the extension and npm package.",
    );
  }

  const response = await publicKeyReader.getPublicKey();

  if (response.error) {
    throw new Error(readFreighterError(response.error));
  }

  const publicKey = response.publicKey || response.address;

  if (!publicKey) {
    throw new Error(
      "Freighter did not return a public key. Make sure the wallet is unlocked and this site is approved.",
    );
  }

  return publicKey;
}

export async function signAndSubmitTransaction(xdr: string) {
  const publicKey = await getFreighterPublicKey();
  const { horizonUrl, networkPassphrase } = getNetworkConfig();

  const signed = await freighterApi.signTransaction(xdr, {
    address: publicKey,
    networkPassphrase,
  });

  if ("error" in signed && signed.error) {
    throw new Error(readFreighterError(signed.error));
  }

  const transaction = TransactionBuilder.fromXDR(
    signed.signedTxXdr,
    networkPassphrase,
  );
  const horizonServer = new Horizon.Server(horizonUrl);

  return horizonServer.submitTransaction(transaction);
}

export async function fundWithFriendbot(publicKey: string) {
  const friendbotUrl = `https://friendbot.stellar.org/?addr=${encodeURIComponent(
    publicKey,
  )}`;

  const response = await fetch(friendbotUrl, {
    method: "GET",
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : "Friendbot funding request failed.";
    throw new Error(detail);
  }

  return data;
}
