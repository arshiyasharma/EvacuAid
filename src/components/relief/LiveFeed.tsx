"use client";

import type { Activity } from "@/lib/activity";
import { dollars } from "@/components/console/useMoney";

const SYSTEM = {
  nessie: { label: "NESSIE", cls: "bg-[#d03027]/20 text-[#ff7b72] border-[#d03027]/40" },
  solana: { label: "SOLANA", cls: "bg-[#9b87f5]/20 text-[#d4caff] border-[#9b87f5]/40" },
  evacuaid: { label: "EVACUAID", cls: "bg-out/15 text-out border-out/30" },
};
const TONE = { ok: "text-out", warn: "text-silent", bad: "text-help", info: "text-fg" };

/** Every real transaction as it happens, one per line, labeled by the system that did it. */
export function LiveFeed({ items, limit = 12, title = "Live transactions", live = true }: { items: Activity[] | undefined; limit?: number; title?: string; live?: boolean }) {
  const list = (items ?? []).slice(0, limit);
  return (
    <section className="panel rounded-3xl p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-3 text-[28px] font-medium tracking-[-0.02em]">
          {live && <span className="live-dot size-2.5 rounded-full bg-out shadow-[0_0_10px_var(--color-out)]" />}
          {title}
        </h2>
        <div className="flex gap-2">
          {(["nessie", "solana"] as const).map((k) => (
            <span key={k} className={`rounded-full border px-3 py-1 font-mono text-[13px] font-semibold tracking-wider ${SYSTEM[k].cls}`}>
              {SYSTEM[k].label}
            </span>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="mt-4 text-[18px] text-muted">Nothing yet. Approve aid in the console, or run a demo night, and watch it land here.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {list.map((a) => (
            <li key={a.id} className="rise grid grid-cols-[104px_96px_1fr_auto] items-center gap-3 py-3">
              <span className="whitespace-nowrap font-mono text-[14px] text-faint">
                {new Date(a.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className={`justify-self-start rounded-full border px-2.5 py-0.5 font-mono text-[12px] font-semibold tracking-wider ${SYSTEM[a.system].cls}`}>
                {SYSTEM[a.system].label}
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-[17px] font-medium ${TONE[a.tone ?? "info"]}`}>{a.what}</span>
                <span className="block truncate text-[14.5px] text-muted">
                  {a.detail}
                  {a.ref && !a.link && <span className="font-mono text-faint"> · {a.ref.slice(0, 16)}…</span>}
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer" className="ml-1 text-[#b9a8ff] hover:underline">
                      Explorer ↗
                    </a>
                  )}
                </span>
              </span>
              <span className="font-mono text-[18px] tabular-nums">{a.cents === undefined ? "" : dollars(a.cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
