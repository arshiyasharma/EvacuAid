"use client";

import { STATUS_META, StatusDot } from "@/components/ui";
import { clockLabel } from "@/lib/replay/eaton";
import type { Suggestion } from "@/lib/ops/recommend";
import type { PriorityResult } from "@/lib/types";
import { CaseCard } from "./CaseCard";
import type { ConsoleHousehold as HouseholdView } from "./ConsoleApp";
import { stipendEligibility } from "@/lib/bank/eligibility";
import { StipendPanel, moneyEntry } from "./StipendPanel";
import type { MoneyState } from "./useMoney";

type Msg = HouseholdView["messages"][number] & { via?: string; error?: string; summary?: string; byOperator?: boolean };

type Props = {
  household: HouseholdView;
  score: PriorityResult;
  suggestion: Suggestion | undefined;
  busy: Map<string, string>;
  onActed: () => void;
  money: MoneyState & { refresh: () => void };
  /** Replay time: eligibility depends on where the situation is right now. */
  at: number;
  operator: boolean;
  onClose: () => void;
};

export function HouseholdDrawer({ household: h, score, suggestion, busy, onActed, money, at, operator, onClose }: Props) {
  const showPrivate = operator || !h.live;

  return (
    <div className="panel rise absolute right-5 top-5 bottom-5 flex w-[420px] flex-col overflow-hidden rounded-2xl">
      <div className="flex items-start justify-between border-b border-line px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusDot status={h.status} size={8} />
            <span className="label text-[13px]">{h.alerted ? STATUS_META[h.status].label : "Not alerted yet"}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[19px] font-medium tracking-[-0.01em]">
            {h.live ? h.name : h.address}
            {h.live && (
              <span className="rounded-full bg-white px-1.5 py-px font-mono text-[12px] font-semibold tracking-wider text-ink">LIVE</span>
            )}
          </div>
          {h.summary && <div className="mt-1 text-[15.5px] text-out">{h.summary}</div>}
          {showPrivate && h.phone && (
          <div className="mt-1 font-mono text-[14.5px] text-muted">
            {h.phone.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, "$1 ($2) $3-$4")}
          </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full text-muted transition hover:bg-white/[0.06] hover:text-fg"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {h.case && (
          <div className="mb-5">
            <div className="label text-[13px]">Case</div>
            <CaseCard h={h} suggestion={suggestion} busy={busy} at={at} operator={operator} onDone={onActed} />
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="label text-[13px]">Priority</span>
          <span className="font-mono text-[13px] text-faint">P(A &lt; T) × V</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 font-mono">
          {[
            ["Fire", score.etaToHazardMin === null ? "—" : `${Math.round(score.etaToHazardMin)}m`, "arrives (A)"],
            ["Leave", score.selfEvacMin ? `${score.selfEvacMin}m` : "—", "on their own (T)"],
            ["P", score.pReach.toFixed(2), "trapped"],
            ["V", score.vulnerability.toFixed(2), "harm"],
          ].map(([k, v, hint]) => (
            <div key={k} className="rounded-xl border border-line bg-white/[0.02] px-2.5 py-2">
              <div className="text-[13px] text-faint">{k}</div>
              <div className="mt-0.5 text-[18px] tabular-nums text-fg">{v}</div>
              <div className="text-[12px] leading-tight text-faint">{hint}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-baseline justify-between rounded-xl border border-line bg-white/[0.02] px-3 py-2 font-mono">
          <span className="text-[13.5px] text-muted">score = P × V</span>
          <span className="text-[20px] tabular-nums text-fg">{score.score.toFixed(3)}</span>
        </div>

        <ul className="mt-4 space-y-1.5">
          {score.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-[15.5px] leading-snug text-muted">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/30" />
              {r}
            </li>
          ))}
        </ul>

        <StipendPanel
          key={h.id}
          householdId={h.id}
          noTransport={h.needs.noTransport || !h.profile.hasCar}
          eligibility={stipendEligibility(h)}
          at={at}
          operator={operator}
          entry={moneyEntry(money, h.id)}
          paidCents={money.stipends
            .filter((s) => s.householdId === h.id && s.decision === "approved")
            .reduce((sum, s) => sum + s.amountCents, 0)}
          onChange={money.refresh}
        />

        <div className="label mt-6 text-[13px]">Messages</div>
        <div className="mt-3 space-y-2.5">
          {!showPrivate && <p className="text-[15.5px] text-faint">Private. Only the operator can read a real resident&apos;s messages.</p>}
          {showPrivate && h.messages.length === 0 && <p className="text-[15.5px] text-faint">No messages yet.</p>}
          {(h.messages as Msg[]).map((m, i) => (
            <div key={i} className={`flex flex-col ${m.from === "resident" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15.5px] leading-snug ${
                  m.from === "resident"
                    ? "rounded-br-md bg-[#2b6cff] text-white"
                    : m.byOperator
                      ? "rounded-bl-md border border-out/30 bg-out/[0.1] text-fg"
                      : "rounded-bl-md bg-white/[0.07] text-fg"
                }`}
              >
                {m.text}
              </div>
              <span className="mt-1 font-mono text-[12px] text-faint">
                {m.byOperator && "operator · "}
                {h.live ? new Date(m.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : clockLabel(m.at)}
                {m.via && ` · ${m.via === "imessage" ? "iMessage" : "simulated"}`}
                {m.error && <span className="text-help"> · failed: {m.error}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
