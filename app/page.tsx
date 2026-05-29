"use client";

import { Suspense, useState } from "react";

import MainFeature from "../components/MainFeature";
import WalletConnect from "../components/WalletConnect";

export default function HomePage() {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_35%,_#0f172a_100%)] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.45em] text-cyan-300/80">
                MeritMint
              </p>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                Academic credential NFTs designed for trust, permanence, and easy
                student sharing.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-300 md:text-lg">
                Institutions can issue soulbound certificates directly to Stellar
                Testnet wallets. Students get a portable on-chain proof link they
                can open, verify, and share in seconds.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200/80">
                  Network
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  Stellar Testnet
                </p>
                <p className="mt-2 text-sm text-cyan-100/80">
                  Soroban RPC, Horizon, and Friendbot are all fixed to Testnet in
                  this app.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Modes
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  Admin + Student
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Mint credentials as the institution, or browse and verify them as
                  a student.
                </p>
              </div>
            </div>
          </div>
        </section>

        <WalletConnect publicKey={publicKey} onWalletChange={setPublicKey} />
        <Suspense
          fallback={
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-6 text-sm text-slate-300 backdrop-blur">
              Loading credential dashboard...
            </section>
          }
        >
          <MainFeature publicKey={publicKey} />
        </Suspense>
      </div>
    </main>
  );
}
