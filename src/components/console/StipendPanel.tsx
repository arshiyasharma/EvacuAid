"use client";

import { useState } from "react";
import type { Eligibility } from "@/lib/bank/eligibility";
import { AID_KINDS, HOUSEHOLD_CAP_CENTS, type AidKind } from "@/lib/budget";
import { liveAction } from "./useLive";
import { dollars, type MoneyState, type StipendEntry } from "./useMoney";

const ICON = { pass: "✓", flag: "!", fail: "✕" } as const;
const TONE = { pass: "text-out", flag: "text-silent", fail: "text-help" } as const;

const SPENDS = [
  { key: "shell-pasadena", label: "Gas", cents: 48_00 },
  { key: "hilton-pasadena", label: "Hotel", cents: 165_00 },
  { key: "electronics-glendale", label: "Electronics", cents: 129_00 },
];

type Props = {
  householdId: string;
  noTransport: boolean;
  eligibility: Eligibility;
  at: number;
  /** Only the signed-in operator can move money. */
  operator: boolean;
  entry: StipendEntry | undefined;
  /** Approved for this household so far tonight, across payments. */
  paidCents: number;
  onChange: () => void;
};

/** In the household drawer: send the stipend, see the fraud check, try the relief card. */
export function StipendPanel({ householdId, noTransport, eligibility, at, operator, entry, paidCents, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spends, setSpends] = useState<{ label: string; approved: boolean }[]>([]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const settled = entry?.decision === "approved" && entry.settlement === "completed";
  const remaining = HOUSEHOLD_CAP_CENTS - paidCents;
  const canPay = operator && eligibility.ok && entry?.decision !== "held";
  const [overCap, setOverCap] = useState<AidKind | null>(null);
  const send = (kind: AidKind, override = false) =>
    run(() => liveAction("/api/bank/stipend", { householdId, noTransport, at, kind, override })).then(() => setOverCap(null));
  const ask = (kind: AidKind) => (AID_KINDS[kind].cents <= remaining ? send(kind) : setOverCap(kind));

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <span className="label text-[13px]">Money · Nessie</span>
        {entry && (
          <span
            className={`label text-[12px] ${
              entry.decision === "approved" ? "text-out" : entry.decision === "held" ? "text-silent" : "text-help"
            }`}
          >
            {entry.decision === "approved" ? (settled ? "Paid" : "Approved · settling") : entry.decision}
          </span>
        )}
      </div>

      {!entry && (
        <ul className="mt-3 space-y-1">
          {eligibility.reasons.map((r) => (
            <li key={r.text} className="flex gap-2.5 text-[15px]">
              <span className={`w-3 shrink-0 font-mono ${r.ok ? "text-out" : "text-faint"}`}>{r.ok ? "✓" : "–"}</span>
              <span className={r.ok ? "text-fg" : "text-muted"}>{r.text}</span>
            </li>
          ))}
        </ul>
      )}

      {!entry && !eligibility.ok && (
        <div className="mt-3 rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-muted">
          No stipend yet: money opens only when an evacuation order covers this home.
        </div>
      )}

      {!entry && eligibility.ok && !operator && (
        <div className="mt-3 rounded-xl border border-line px-3.5 py-2.5 text-[15px] text-muted">Eligible. Only the operator can send money.</div>
      )}

      {canPay && (
        <div className="mt-3">
          <div className="flex justify-between text-[14px] text-muted">
            <span>{paidCents ? "Top up" : "Send aid"} · pay what gets them out</span>
            <span className="font-mono">
              {dollars(paidCents)} / {dollars(HOUSEHOLD_CAP_CENTS)}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(Object.keys(AID_KINDS) as AidKind[]).map((k) => {
              const a = AID_KINDS[k];
              const fits = a.cents <= remaining;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={busy}
                  title={fits ? a.what : "Over this household's $770 cap: you'll be asked to confirm"}
                  onClick={() => ask(k)}
                  className={`rounded-xl border px-2 py-2.5 text-left transition disabled:opacity-35 ${
                    !fits
                      ? "border-help/40 text-help hover:bg-help/10"
                      : k === "full"
                        ? "border-fg bg-fg text-ink hover:bg-white"
                        : "border-line-strong hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="font-mono text-[17px] font-medium">{dollars(a.cents)}</div>
                  <div className={`text-[12.5px] leading-tight ${k === "full" ? "text-ink/70" : "text-muted"}`}>{a.label}</div>
                </button>
              );
            })}
          </div>
          {overCap && (
            <div className="rise mt-3 rounded-xl border border-help/50 bg-help/[0.09] p-3.5">
              <div className="text-[15.5px] font-medium text-help">Are you sure they need this right now?</div>
              <p className="mt-1 text-[14px] leading-snug text-muted">
                {dollars(AID_KINDS[overCap].cents)} more takes this household to {dollars(paidCents + AID_KINDS[overCap].cents)}, over the{" "}
                {dollars(HOUSEHOLD_CAP_CENTS)} cap. Donor money on Solana can&apos;t go past the cap, so the extra comes from the county fund and is
                logged as an operator override.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => send(overCap, true)}
                  className="flex-1 rounded-lg bg-help py-2 text-[14.5px] font-medium text-white disabled:opacity-50"
                >
                  Yes, send {dollars(AID_KINDS[overCap].cents)}
                </button>
                <button
                  type="button"
                  onClick={() => setOverCap(null)}
                  className="flex-1 rounded-lg border border-line-strong py-2 text-[14.5px] text-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {busy && <div className="mt-2 text-[14px] text-muted">Running the five bank checks…</div>}
        </div>
      )}

      {entry && (
        <>
          <ul className="mt-3 space-y-1.5">
            {entry.checks.map((c) => (
              <li key={c.name} className="flex gap-2.5 text-[15px] leading-snug">
                <span className={`w-3 shrink-0 font-mono ${TONE[c.result]}`}>{ICON[c.result]}</span>
                <span className="text-muted">
                  <span className="text-fg">{c.name}.</span> {c.detail}
                </span>
              </li>
            ))}
          </ul>

          {entry.decision === "held" && operator && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => liveAction("/api/bank/decide", { householdId, approve: true }))}
                className="flex-1 rounded-xl bg-out/90 py-2 text-[15.5px] font-medium text-ink disabled:opacity-50"
              >
                Approve {dollars(entry.amountCents)}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => liveAction("/api/bank/decide", { householdId, approve: false }))}
                className="flex-1 rounded-xl border border-help/50 py-2 text-[15.5px] text-help disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )}

          {entry.decision === "approved" && operator && (
            <div className="mt-4">
              <div className="text-[14px] text-faint">Relief card: only evacuation spending goes through.</div>
              <div className="mt-2 flex gap-2">
                {SPENDS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    disabled={busy || !settled}
                    onClick={() =>
                      run(async () => {
                        const r = (await liveAction("/api/bank/spend", { householdId, merchantKey: s.key, cents: s.cents })) as {
                          approved: boolean;
                        };
                        setSpends((prev) => [{ label: `${s.label} ${dollars(s.cents)}`, approved: r.approved }, ...prev]);
                      })
                    }
                    className="flex-1 rounded-lg border border-line-strong py-1.5 text-[14.5px] text-muted transition hover:text-fg disabled:opacity-40"
                  >
                    {s.label} {dollars(s.cents)}
                  </button>
                ))}
              </div>
              {spends.map((s, i) => (
                <div key={i} className="mt-1.5 text-[14.5px]">
                  <span className={s.approved ? "text-out" : "text-help"}>{s.approved ? "Approved" : "Declined"}</span>{" "}
                  <span className="text-muted">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="mt-2 text-[14.5px] text-help">{error}</p>}
    </div>
  );
}

export function moneyEntry(money: MoneyState, householdId: string) {
  return money.stipends.find((s) => s.householdId === householdId);
}
