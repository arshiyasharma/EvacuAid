"use client";

import { useState } from "react";
import { dollars, type MoneyState } from "@/components/console/useMoney";
import { LiveFeed } from "./LiveFeed";

/** Earlier drill runs: totals at a glance, every transaction one tap away. */
export function HistoryTab({ money }: { money: MoneyState }) {
  const runs = money.history ?? [];
  const [open, setOpen] = useState<number | null>(null);
  if (runs.length === 0) {
    return (
      <div className="rise mt-10 rounded-3xl border border-line bg-white/[0.02] p-10 text-center">
        <div className="text-[26px] font-medium">No earlier runs yet</div>
        <p className="mt-2 text-[18px] text-muted">When the operator resets the drill, the night moves here.</p>
      </div>
    );
  }
  return (
    <div className="rise mt-10 space-y-4">
      {runs.map((r) => (
        <div key={r.run} className="panel overflow-hidden rounded-3xl">
          <button type="button" onClick={() => setOpen(open === r.run ? null : r.run)} className="w-full p-6 text-left transition hover:bg-white/[0.02]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="text-[24px] font-medium">Run {r.run}</div>
                <div className="text-[15px] text-faint">
                  {new Date(r.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} –{" "}
                  {new Date(r.endedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {r.items.length} transactions
                </div>
              </div>
              <span className="text-[15px] text-muted">{open === r.run ? "Hide ▲" : "Show every transaction ▼"}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Approved on Nessie" value={dollars(r.approvedCents)} tone="text-out" />
              <Stat label="Released on Solana" value={dollars(r.releasedCents)} tone="text-[#d4caff]" />
              <Stat label="Donated" value={dollars(r.donatedCents)} tone="text-fg" />
              <Stat label="Fraud blocked" value={String(r.blocked)} tone="text-help" />
            </div>
          </button>
          {open === r.run && (
            <div className="border-t border-line p-4">
              <LiveFeed items={r.items} limit={200} title={`Run ${r.run} transactions`} live={false} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink/40 px-4 py-3">
      <div className="text-[14px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[24px] tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
