"use client";

import { useState } from "react";

import { STATUS_META, StatusDot } from "@/components/ui";
import type { Counts } from "@/lib/replay/households";
import type { ConsoleHousehold as HouseholdView } from "./ConsoleApp";
import type { Assignment, PriorityResult, Status } from "@/lib/types";

const ORDER: Status[] = ["needs_help", "no_response", "leaving", "out"];

type Props = {
  tab: "priority" | "money";
  onTab: (t: "priority" | "money") => void;
  moneyView: React.ReactNode;
  counts: Counts;
  ranked: PriorityResult[];
  byId: Map<string, HouseholdView>;
  assignments: Assignment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Payments the bank checks held for a person to decide. */
  held: { householdId: string; label: string; amountCents: number; reason?: string }[];
  fleetSize: number;
  nearestFireMin: number | null;
  /** Vehicles in your sector that are out on a trip. */
  busyCount: number;
  suggestions: Map<string, { name: string; etaMin: number } | null>;
};

function needTags(h: HouseholdView): string[] {
  const n = h.needs;
  return [
    h.doorKnock && "door knock",
    h.leftBehind && "left behind",
    n.mobility && "mobility",
    n.medical && "medical",
    n.noTransport && "no car",
    n.money && "money",
    n.children && "kids",
    n.pets && "pets",
    h.language !== "en" && h.language.toUpperCase(),
  ].filter(Boolean) as string[];
}

export function SidePanel({
  tab,
  onTab,
  moneyView,
  counts,
  ranked,
  byId,
  assignments,
  selectedId,
  onSelect,
  held,
  fleetSize,
  nearestFireMin,
  busyCount,
  suggestions,
}: Props) {
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const assigned = new Map(assignments.map((a) => [a.householdId, a]));
  const everyone = ranked.filter((r) => {
    const h = byId.get(r.householdId);
    return h && h.alerted && h.status !== "out" && r.score > 0.005;
  });
  const queue = scope === "mine" ? everyone.filter((r) => byId.get(r.householdId)?.sector === "you") : everyone;

  return (
    <aside className="flex min-h-0 flex-col border-l border-line bg-surface/60">
      <div className="grid grid-cols-2 gap-px border-b border-line bg-line">
        {ORDER.map((s) => (
          <div key={s} className="bg-surface px-6 py-5 transition-colors hover:bg-raised">
            <div className="flex items-center gap-2">
              <StatusDot status={s} size={7} />
              <span className="label text-[13px]">{STATUS_META[s].label}</span>
            </div>
            <div
              className={`mt-2 font-mono text-[38px] font-light tabular-nums tracking-tight transition-colors ${
                counts[s] ? "text-fg" : "text-fg/30"
              }`}
            >
              {counts[s]}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-6 pb-3 pt-5">
        <div className="flex gap-5">
          {(["priority", "money"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTab(t)}
              className={`label border-b pb-1 transition ${tab === t ? "border-fg text-fg" : "border-transparent hover:text-fg"}`}
            >
              {t === "priority" ? (
                <>
                  Priority <span className="text-faint">· {queue.length}</span>
                </>
              ) : (
                "Money"
              )}
            </button>
          ))}
        </div>
        {tab === "priority" && <span className="font-mono text-[14.5px] text-faint">P(trapped) × V</span>}
      </div>

      {tab === "money" ? (
        moneyView
      ) : queue.length === 0 ? (
        <div className="grid flex-1 place-items-center px-8 text-center">
          <p className="text-[17px] leading-relaxed text-faint">
            {counts.alerted === 0 ? "Press play. Households appear as the alert goes out." : "Nobody waiting."}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
        <NeedsNow
          ranked={everyone}
          byId={byId}
          held={held}
          busy={busyCount}
          fleetSize={fleetSize}
          needHelp={counts.needs_help}
          nearestFireMin={nearestFireMin}
          suggestions={suggestions}
          onSelect={onSelect}
        />
        <div className="flex gap-1 px-6 pb-2">
          {(["mine", "all"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={`rounded-full px-3 py-1 text-[13.5px] transition ${scope === k ? "bg-white/[0.1] text-fg" : "text-muted hover:text-fg"}`}
            >
              {k === "mine" ? "Your sector" : "All west Altadena"}
            </button>
          ))}
        </div>
        <ol className="px-3 pb-4">
          {queue.slice(0, 60).map((r, i) => {
            const h = byId.get(r.householdId)!;
            const a = assigned.get(h.id);
            const active = h.id === selectedId;
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onSelect(h.id)}
                  className={`group w-full rounded-xl px-3 py-3 text-left transition ${
                    active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 font-mono text-[14px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                    <StatusDot status={h.status} size={8} />
                    <span className="flex-1 truncate text-[17px] text-fg">
                      {h.live ? h.name : h.address}
                      {h.live && (
                        <span className="ml-2 rounded-full bg-white px-1.5 py-px align-middle font-mono text-[12px] font-semibold tracking-wider text-ink">
                          LIVE
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[15px] tabular-nums text-fg">{(r.score * 100).toFixed(0)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-9">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, r.score * 100 * 1.6)}%`,
                          background: `linear-gradient(90deg, var(--color-silent), var(--color-help))`,
                        }}
                      />
                    </div>
                    {r.etaToHazardMin !== null && (
                      <span className="font-mono text-[13.5px] text-muted">
                        {r.etaToHazardMin < 1 ? "fire here" : `fire ${Math.round(r.etaToHazardMin)}m`}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-9">
                    {needTags(h).map((t) => (
                      <span key={t} className="rounded-full border border-line-strong px-2 py-0.5 text-[13px] text-muted">
                        {t}
                      </span>
                    ))}
                    {a && (
                      <span className="rounded-full border border-out/40 bg-out/10 px-2 py-0.5 text-[13px] text-out">
                        pickup {a.etaMin}m
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
        </div>
      )}
    </aside>
  );
}

/** The top of the queue: what you should decide in the next minute. */
function NeedsNow({
  ranked,
  byId,
  held,
  busy,
  fleetSize,
  needHelp,
  nearestFireMin,
  suggestions,
  onSelect,
}: {
  ranked: PriorityResult[];
  byId: Map<string, HouseholdView>;
  held: Props["held"];
  busy: number;
  fleetSize: number;
  needHelp: number;
  nearestFireMin: number | null;
  suggestions: Props["suggestions"];
  onSelect: (id: string) => void;
}) {
  const open = ranked.filter((r) => {
    const h = byId.get(r.householdId) as (HouseholdView & { case?: { kind: string; status: string; aid?: string } }) | undefined;
    return h && h.sector === "you" && h.case && h.case.status === "review";
  });
  const allMine = [...byId.values()].filter((h) => h.sector === "you" && h.alerted).length;
  if (!open.length && !held.length && needHelp === 0) return null;
  return (
    <div className="mx-3 mb-3 rounded-2xl border border-help/30 bg-help/[0.06] p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-[12px] text-help">Needs you now</span>
        <span className="text-[13px] text-muted">
          {busy}/{fleetSize} of your vehicles out
          {nearestFireMin !== null && ` · fire ${Math.round(nearestFireMin)} min away`}
        </span>
      </div>
      <div className="mt-1 text-[13.5px] text-faint">
        Your sector: {allMine} homes · {open.length} waiting for you. {needHelp} still need help across west Altadena; other operators have the rest.
      </div>
      {open.length === 0 && held.length === 0 && <div className="mt-2 text-[14.5px] text-out">Nothing waiting on you right now.</div>}
      <ul className="mt-2 space-y-1">
        {held.map((p) => (
          <li key={`held-${p.householdId}`}>
            <button
              type="button"
              onClick={() => onSelect(p.householdId)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15.5px]">Payment held · {p.label}</span>
                {p.reason && <span className="block truncate text-[13px] text-faint">{p.reason}</span>}
              </span>
              <span className="shrink-0 rounded-full bg-silent/20 px-2.5 py-0.5 font-mono text-[13px] text-silent">review</span>
            </button>
          </li>
        ))}
        {open.slice(0, 6).map((r) => {
          const h = byId.get(r.householdId) as HouseholdView & { live?: boolean; name?: string; case: { kind: string; aid?: string } };
          const s = suggestions.get(h.id);
          const action =
            h.case.kind === "aid"
              ? `Approve ${h.case.aid === "night" ? "$315 gas + night" : h.case.aid === "full" ? "$770" : "$150 gas"}?`
              : s
                ? `Send ${s.name} · ${s.etaMin} min?`
                : "No vehicle free";
          const tag = h.case.kind === "aid" ? "AID" : h.case.kind === "check" ? "KNOCK" : "RIDE";
          return (
            <li key={`open-${h.id}`}>
              <button
                type="button"
                onClick={() => onSelect(h.id)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.05]"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11.5px] font-semibold tracking-wider text-help">{tag}</span>
                    <span className="truncate text-[15.5px]">{h.live ? `${h.name} · LIVE` : h.address}</span>
                  </span>
                  <span className="block truncate text-[13px] text-faint">{h.summary ?? "needs help"}</span>
                </span>
                <span className="shrink-0 text-right text-[13px] text-out">{action}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
