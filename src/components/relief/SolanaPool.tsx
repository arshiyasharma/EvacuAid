"use client";

import { dollars, explorerAddress, explorerTx, type PoolState } from "@/components/console/useMoney";

const RULES = [
  ["Locked until the order", "Unlocks only when the evacuation order is on-chain."],
  ["$770 per household", "Never more, however it's split."],
  ["Only to the county", "No other account can receive it."],
  ["Every dollar public", "Each release is an Explorer link."],
];

/** The donor side: money on Solana, the rules it obeys, and every release as a public transaction. */
export function SolanaPool({ pool }: { pool: PoolState | null | undefined }) {
  return (
    <section className="rounded-3xl border border-[#9b87f5]/30 bg-[#9b87f5]/[0.05] p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="label text-[#b9a8ff]">Donor pool · Solana devnet</div>
          <h2 className="mt-2 text-[34px] font-medium leading-tight tracking-[-0.025em]">Rules in code. Every dollar public.</h2>
        </div>
        {pool && (
          <a
            href={explorerAddress(pool.programId)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[#9b87f5]/50 px-4 py-2 text-[15px] text-[#d4caff] transition hover:bg-[#9b87f5]/10"
          >
            View the program ↗
          </a>
        )}
      </div>

      {!pool ? (
        <p className="mt-6 text-[16px] text-faint">The pool isn&apos;t connected on this server.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Num label="Donated" value={dollars(pool.donatedCents)} sub={`${pool.donors} donors`} />
            <Num label="Released to families" value={dollars(pool.releasedCents)} sub={`${pool.releases} releases`} />
            <Num label="Still in the pool" value={dollars(pool.vaultCents)} sub="ready for the next order" />
            <Num
              label="Evacuation order"
              value={pool.orderPublished ? "On-chain" : "Not yet"}
              sub={pool.zone.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
              tone={pool.orderPublished ? "text-out" : "text-muted"}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <ul className="grid gap-3 sm:grid-cols-2">
              {RULES.map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-line bg-ink/40 p-4">
                  <div className="text-[19px] font-medium">{title}</div>
                  <div className="mt-1 text-[15.5px] leading-snug text-muted">{body}</div>
                </li>
              ))}
            </ul>
            <div>
              <div className="text-[15.5px] text-muted">Latest on-chain activity</div>
              <ul className="mt-2 divide-y divide-line">
                {pool.recent.slice(0, 6).map((r) => (
                  <li key={r.sig} className="flex items-center justify-between gap-3 py-2">
                    <a href={explorerTx(r.sig)} target="_blank" rel="noreferrer" className="truncate font-mono text-[14px] text-[#d4caff] hover:underline">
                      {r.sig.slice(0, 20)}…
                    </a>
                    <span className="shrink-0 text-[13.5px] text-faint">
                      {r.at ? new Date(r.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[15px] text-faint">Before an order, over the cap, or to anyone else: refused on-chain.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Num({ label, value, sub, tone = "text-fg" }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink/40 px-4 py-4">
      <div className="text-[14.5px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-[34px] leading-none tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1.5 text-[13.5px] text-faint">{sub}</div>
    </div>
  );
}
