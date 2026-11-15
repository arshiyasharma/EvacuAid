"use client";

import { useCallback, useEffect, useState } from "react";
import type { CheckResult } from "@/lib/bank/nessie";

export type StipendEntry = {
  householdId: string;
  label: string;
  decision: "approved" | "held" | "declined";
  transactionId?: string;
  checks: CheckResult[];
  amountCents: number;
  at: number;
  settlement?: string;
  kind?: "gas" | "night" | "full";
  replayAt?: number;
  override?: boolean;
  funding?: { source: "solana" | "county"; status: "releasing" | "released" | "fallback"; sig?: string; error?: string };
};

export type PoolState = {
  programId: string;
  pool: string;
  incident: string;
  zone: string;
  donors: number;
  donatedCents: number;
  releasedCents: number;
  vaultCents: number;
  releases: number;
  capCents: number;
  orderPublished: boolean;
  recent: { sig: string; at: number | null }[];
};

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddress = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;

export type SpendEntry = {
  at: number;
  householdId: string;
  label: string;
  merchant: string;
  category: string;
  cents: number;
  approved: boolean;
  transactionId: string;
};

export type MoneyState = {
  fund: {
    balanceCents: number;
    availableCents: number;
    pendingCents: number;
    startingCents: number;
    bridgeCents: number;
    stipends: number;
    accounts: { reliefFund?: string; solanaBridge: string | null };
  } | null;
  stipends: StipendEntry[];
  spends?: SpendEntry[];
  pool?: PoolState | null;
  activity?: import("@/lib/activity").Activity[];
  run?: number;
  history?: ReturnType<typeof import("@/lib/activity").activityHistory>;
  earlier?: { endedAt: number; payments: number; paidCents: number; blocked: number; fromDonorsCents: number }[];
  ops?: { balanceCents: number; availableCents: number; startingCents: number } | null;
  bills?: { at: number; householdId: string; label: string; cents: number; transactionId?: string; vehicleName: string }[];
  operator?: boolean;
  error?: string;
};

/** Polls the Nessie-backed money snapshot. */
export function useMoney(intervalMs = 4000) {
  const [state, setState] = useState<MoneyState>({ fund: null, stipends: [] });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch("/api/bank/money", { cache: "no-store" });
        if (res.ok) setState(await res.json());
        else setState((s) => ({ ...s, error: `Bank unavailable (${res.status})` }));
      } catch {
        setState((s) => ({ ...s, error: "Bank unavailable" }));
      }
      if (!stop) timer = setTimeout(load, intervalMs);
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [intervalMs, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refresh };
}

export const dollars = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
