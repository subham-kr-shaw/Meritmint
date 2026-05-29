"use client";

import { useState } from "react";

import { fundWithFriendbot, getFreighterPublicKey } from "../lib/stellar";

interface WalletConnectProps {
  publicKey: string | null;
  onWalletChange: (publicKey: string | null) => void;
}

function truncatePublicKey(publicKey: string) {
  return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />
  );
}

export default function WalletConnect({
  publicKey,
  onWalletChange,
}: WalletConnectProps) {
  const [loadingAction, setLoadingAction] = useState<"connect" | "fund" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoadingAction("connect");
    setError(null);
    setSuccess(null);

    try {
      const connectedPublicKey = await getFreighterPublicKey();
      onWalletChange(connectedPublicKey);
      setSuccess("Freighter connected on Stellar Testnet.");
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Unable to connect to Freighter.",
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnect = () => {
    onWalletChange(null);
    setError(null);
    setSuccess("Wallet disconnected from the app.");
  };

  const handleFund = async () => {
    if (!publicKey) {
      setError("Connect a wallet before requesting Testnet XLM.");
      return;
    }

    setLoadingAction("fund");
    setError(null);
    setSuccess(null);

    try {
      await fundWithFriendbot(publicKey);
      setSuccess("Friendbot sent Testnet XLM to your wallet.");
    } catch (fundError) {
      setError(
        fundError instanceof Error
          ? fundError.message
          : "Friendbot request failed.",
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-[0_20px_80px_rgba(8,15,32,0.45)] backdrop-blur">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
            Wallet
          </p>
          <h2 className="text-2xl font-semibold text-white">
            {publicKey ? truncatePublicKey(publicKey) : "Freighter not connected"}
          </h2>
          <p className="max-w-2xl text-sm text-slate-300">
            MeritMint only talks to Stellar Testnet. Keep Freighter set to
            Testnet before signing any contract transaction.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {publicKey ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-200"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={loadingAction === "connect"}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingAction === "connect" ? <Spinner /> : null}
              Connect Wallet
            </button>
          )}

          <button
            type="button"
            onClick={handleFund}
            disabled={!publicKey || loadingAction === "fund"}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === "fund" ? <Spinner /> : null}
            Get Testnet XLM
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </p>
      ) : null}
    </section>
  );
}
