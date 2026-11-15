"use client";

import Link from "next/link";
import { advise, PLANS, POOL_PLEDGED_CENTS } from "@/lib/budget";
import type { ForecastResult } from "@/lib/forecast";
import { clockLabel } from "@/lib/replay/eaton";
import { dollars, explorerTx, type MoneyState } from "./useMoney";

type Situation = { ordered: number; needHelp: number; silent: number; stuck: number; nearestFireMin: number | null };

type Props = {
  money: MoneyState;
  forecasts: Record<string, ForecastResult>;
  simAt: number;
  situation: Situation;
  horizonHours: number;
  operator: boolean;
  onSelect: (id: string) => void;
};

const TONE = {
  ok: { text: "text-out", ring: "border-out/30 bg-out/[0.06]" },
  watch: { text: "text-silent", ring: "border-silent/30 bg-silent/[0.06]" },
  short: { text: "text-help", ring: "border-help/35 bg-help/[0.07]" },
};

function severity(s: Situation): { label: string; tone: string } {
  if (s.ordered === 0) return { label: "No order yet", tone: "text-muted" };
  const close = s.nearestFireMin !== null && s.nearestFireMin < 30;
  if (close || s.needHelp >= 25) return { label: "Severe", tone: "text-help" };
  if (s.needHelp >= 8 || s.silent >= 40) return { label: "High", tone: "text-silent" };
  return { label: "Watch", tone: "text-leaving" };
}

/** The operator's money view: what's left, what the simulations say, who got paid. */
export function MoneyPanel({ money, forecasts, simAt, situation, horizonHours, operator, onSelect }: Props) {
  const available = money.fund?.availableCents ?? 0;
  const start = money.fund?.startingCents ?? 120_000_00;
  const paid = money.stipends.filter((s) => s.decision === "approved");
  const held = money.stipends.filter((s) => s.decision === "held");
  const blocked = money.stipends.filter((s) => s.decision === "declined");
  const a = advise(available, forecasts);
  const sev = severity(situation);
  const usedPct = Math.min(100, ((start - available) / start) * 100);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
      {/* Budget */}
      <div className="flex items-baseline justify-between">
        <span className="label text-[12px]">Budget left</span>
        <Link href="/relief" className="text-[14.5px] text-muted transition hover:text-fg">
          Relief fund →
        </Link>
      </div>
      <div className="mt-1.5 font-mono text-[40px] font-light leading-none tabular-nums tracking-tight">
        {money.fund ? dollars(available) : "—"}
      </div>
      {money.error && !money.fund && <div className="mt-1 text-[14px] text-help">{money.error}</div>}
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full bg-out" style={{ width: `${100 - usedPct}%` }} title="County relief fund left" />
      </div>
      <div className="mt-1.5 flex justify-between text-[13.5px] text-muted">
        <span>County fund · Nessie</span>
        <span>
          +{dollars(money.pool?.vaultCents ?? POOL_PLEDGED_CENTS)} <span className="text-[#b9a8ff]">Solana donors</span>
        </span>
      </div>

      {/* Situation */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <Stat label="Situation" value={sev.label} tone={sev.tone} />
        <Stat label="Need help" value={String(situation.needHelp)} tone="text-help" />
        <Stat
          label="Fire to nearest"
          value={situation.nearestFireMin === null ? "—" : `${Math.round(situation.nearestFireMin)} min`}
          tone="text-fg"
        />
      </div>

      {/* Advice from the simulations */}
      <div className={`mt-4 rounded-2xl border p-4 ${TONE[a.tone].ring}`}>
        <div className={`text-[17px] font-medium ${TONE[a.tone].text}`}>{a.headline}</div>
        <p className="mt-1 text-[14.5px] leading-snug text-muted">{a.detail}</p>
        <div className="mt-3 space-y-1.5">
          {PLANS.map((p) => {
            const lasts = 1 - forecasts[p.key].shortfallChance;
            return (
              <div key={p.key} className="grid grid-cols-[18px_1fr_44px] items-center gap-2 text-[13.5px]">
                <span className="font-mono text-faint">{p.letter}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{ width: `${lasts * 100}%`, background: lasts < 0.9 ? "var(--color-help)" : "var(--color-out)" }}
                    title={`${p.name}: lasts ${Math.round(lasts * 100)}% of nights`}
                  />
                </div>
                <span className="text-right font-mono tabular-nums">{Math.round(lasts * 100)}%</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-[12.5px] text-faint">
          {(forecasts.asked.runs * PLANS.length).toLocaleString()} nights simulated at {clockLabel(simAt)} · next {horizonHours} h · likely need{" "}
          {dollars(forecasts.asked.p50Cents)}, bad night {dollars(forecasts.asked.p90Cents)}
        </div>
      </div>

      {/* Totals */}
      <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
        <Stat label="Paid" value={dollars(paid.reduce((a, s) => a + s.amountCents, 0))} tone="text-out" />
        <Stat label="Waiting" value={String(held.length)} tone="text-silent" />
        <Stat label="Blocked" value={dollars(blocked.reduce((a, s) => a + s.amountCents, 0))} tone="text-help" />
      </div>

      {/* Who got money */}
      <div className="label mt-6 text-[12px]">Payments tonight</div>
      <ul className="mt-2 divide-y divide-line">
        {money.stipends.length === 0 && (
          <li className="py-2 text-[14.5px] text-faint">
            {operator ? "Open a household in an ordered zone to send a stipend." : "No payments yet."}
          </li>
        )}
        {money.stipends.map((s) => {
          const why = s.checks.find((c) => c.result === "fail") ?? s.checks.find((c) => c.result === "flag");
          const tone = s.decision === "approved" ? "text-out" : s.decision === "held" ? "text-silent" : "text-help";
          return (
            <li key={`${s.householdId}:${s.transactionId ?? s.at}`}>
              <button
                type="button"
                onClick={() => onSelect(s.householdId)}
                className="w-full py-2.5 text-left transition hover:bg-white/[0.03]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15.5px]">{s.label}</span>
                  <span className={`shrink-0 font-mono text-[14px] ${tone}`}>
                    {s.decision === "approved" ? dollars(s.amountCents) : s.decision === "held" ? "review" : "blocked"}
                  </span>
                </div>
                <div className="mt-0.5 flex justify-between gap-3 text-[13px] text-faint">
                  <span className="truncate">
                    {s.decision !== "approved"
                      ? why?.detail
                      : s.funding?.source === "solana"
                        ? s.funding.status === "released"
                          ? "Solana donors → county → card"
                          : "Releasing from Solana…"
                        : "County relief fund → card"}
                  </span>
                  {s.funding?.sig && (
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(explorerTx(s.funding!.sig!), "_blank", "noreferrer");
                      }}
                      className="shrink-0 text-[#b9a8ff] hover:underline"
                    >
                      on-chain ↗
                    </span>
                  )}
                  {s.decision === "approved" && <span className="shrink-0">{s.settlement === "completed" ? "paid" : "settling"}</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <div className="text-[12.5px] text-faint">{label}</div>
      <div className={`mt-0.5 truncate text-[18px] tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
