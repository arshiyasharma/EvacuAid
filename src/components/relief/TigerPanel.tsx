"use client";

import { useEffect, useState } from "react";
import { dollars } from "@/components/console/useMoney";
import type { Metrics } from "@/lib/tiger";

const TILES: { label: string; kinds: string[]; money?: boolean; tone: string }[] = [
  { label: "Texts in", kinds: ["text_in"], tone: "#5ab0ff" },
  { label: "Texts out", kinds: ["text_out"], tone: "#8fd3ff" },
  { label: "Cases opened", kinds: ["case_ride", "case_aid", "case_check"], tone: "#ff4d3a" },
  { label: "Vehicles sent", kinds: ["dispatch"], tone: "#ffb224" },
  { label: "Aid approved", kinds: ["aid_approved"], money: true, tone: "#3ee07f" },
  { label: "Released on Solana", kinds: ["solana_release"], money: true, tone: "#b9a8ff" },
];

/** The incident's memory, read live from Tiger Data's continuous aggregate. */
export function TigerPanel() {
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/metrics", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => !stop && setM(j))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 10_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const sum = (kinds: string[], money?: boolean) => kinds.reduce((s, k) => s + (money ? (m?.totals[k]?.cents ?? 0) : (m?.totals[k]?.n ?? 0)), 0);
  // Activity per 5-minute bucket, for the bar strip.
  const buckets = new Map<string, number>();
  for (const s of m?.series ?? []) buckets.set(s.bucket, (buckets.get(s.bucket) ?? 0) + s.n);
  const bars = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-36);
  const peak = Math.max(1, ...bars.map((b) => b[1]));

  return (
    <section className="panel rounded-3xl p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-medium tracking-[-0.02em]">The night, in Tiger Data</h2>
          <p className="mt-1 text-[16px] text-muted">Every text, case, dispatch and dollar is a row in a TimescaleDB hypertable.</p>
        </div>
        <span className="rounded-full border border-[#f5c518]/40 bg-[#f5c518]/10 px-3 py-1 font-mono text-[13px] font-semibold tracking-wider text-[#f5c518]">
          TIGER DATA
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {TILES.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-ink/40 px-4 py-4">
            <div className="text-[14px] text-muted">{t.label}</div>
            <div className="mt-1 font-mono text-[28px] leading-none tabular-nums" style={{ color: t.tone }}>
              {m ? (t.money ? dollars(sum(t.kinds, true)) : sum(t.kinds)) : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="text-[15px] text-muted">Events per 5 minutes</div>
        <div className="mt-2 flex h-24 items-end gap-1">
          {bars.length === 0 && <div className="text-[15px] text-faint">Waiting for the first events of this run…</div>}
          {bars.map(([b, n]) => (
            <div key={b} title={`${new Date(b).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: ${n}`} className="flex-1 rounded-t bg-[#f5c518]/70" style={{ height: `${(n / peak) * 100}%` }} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[13px] text-faint">
        <span>{m?.ok ? `query ${m.ms} ms` : "connecting…"}</span>
        <span>{m?.rows?.toLocaleString() ?? 0} rows in evac_events</span>
        <span>time_bucket(&apos;5 minutes&apos;) · continuous aggregate · refreshed every minute</span>
      </div>
    </section>
  );
}
