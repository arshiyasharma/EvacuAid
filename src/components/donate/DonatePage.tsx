"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavLinks } from "@/components/NavLinks";
import { SolanaPool } from "@/components/relief/SolanaPool";
import { LiveTag, Logo } from "@/components/ui";
import { dollars, explorerTx, useMoney } from "@/components/console/useMoney";

type Receipt = {
  gift: { id: string; at: number; cents: number; name: string; sig: string };
  uses: { at: number; fromYouCents: number; totalCents: number; sig: string; nessieTx?: string; kind: string }[];
  remainingCents: number;
  poolCents: number | null;
  shareNow: number | null;
};
type Recent = { id: string; at: number; cents: number; name: string; sig: string };

const AMOUNTS = [25, 100, 1_000, 10_000];
const KIND_LABEL: Record<string, string> = { gas: "gas to evacuate", night: "gas and a night in a room", full: "gas, food and two nights" };

export function DonatePage() {
  const money = useMoney(5000);
  const [amount, setAmount] = useState(100);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remember your gift on this device so you can come back and see where it went.
  const [giftId, setGiftId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("evacuaid-gift");
    } catch {
      return null;
    }
  });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const [r, list] = await Promise.all([
        giftId ? fetch(`/api/donate?id=${giftId}`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)) : null,
        fetch("/api/donate", { cache: "no-store" }).then((x) => x.json()),
      ]).catch(() => [null, { recent: [] }]);
      if (stop) return;
      if (r) setReceipt(r);
      setRecent(list?.recent ?? []);
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [giftId]);

  async function give(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsd: amount, name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Couldn't give right now");
      setGiftId(j.id);
      try {
        localStorage.setItem("evacuaid-gift", j.id);
      } catch {
        // storage blocked
      }
      money.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 sm:px-8">
      <header className="flex h-16 items-center justify-between border-b border-line">
        <div className="flex items-center gap-5">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <span className="hidden h-4 w-px bg-line-strong sm:block" />
          <NavLinks className="hidden sm:flex" />
        </div>
        <LiveTag color="#9b87f5">Solana devnet</LiveTag>
      </header>

      <section className="rise mt-12 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="label text-[#b9a8ff]">Eaton fire relief pool</div>
          <h1 className="mt-3 text-[clamp(40px,5vw,64px)] font-medium leading-[1.02] tracking-[-0.035em]">
            Give tonight.
            <br />
            See exactly where it went.
          </h1>
          <p className="mt-5 max-w-[520px] text-[21px] leading-snug text-muted">Only families in an ordered zone. Only after bank checks.</p>
          <p className="mt-4 inline-block rounded-xl border border-silent/30 bg-silent/[0.06] px-4 py-2.5 text-[15.5px] text-silent">
            Test dollars on devnet. Real transactions.
          </p>
        </div>

        <form onSubmit={give} className="panel self-start rounded-3xl p-6 sm:p-7">
          <div className="text-[19px] font-medium">Choose an amount</div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(a)}
                className={`rounded-xl border py-3 font-mono text-[16px] transition ${amount === a ? "border-[#9b87f5] bg-[#9b87f5]/15 text-fg" : "border-line text-muted hover:text-fg"}`}
              >
                ${a.toLocaleString()}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-line-strong px-4 py-3 focus-within:border-white/40">
            <span className="font-mono text-[18px] text-muted">$</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, "")) || 0)}
              className="w-full bg-transparent font-mono text-[18px] outline-none"
              aria-label="Amount in dollars"
            />
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional, shown publicly)"
            className="mt-3 w-full rounded-xl border border-line-strong bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-faint focus:border-white/40"
          />
          <button
            type="submit"
            disabled={busy || amount < 5}
            className="mt-4 w-full rounded-xl bg-[#9b87f5] py-3.5 text-[17px] font-medium text-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Sending on Solana…" : `Give $${amount.toLocaleString()} (test)`}
          </button>
          {error && <p className="mt-2 text-[15px] text-help">{error}</p>}
        </form>
      </section>

      {receipt && (
        <section className="rise mt-10 rounded-3xl border border-[#9b87f5]/40 bg-[#9b87f5]/[0.06] p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="label text-[#b9a8ff]">Your gift</div>
              <div className="mt-2 font-mono text-[40px] leading-none">{dollars(receipt.gift.cents)}</div>
              <div className="mt-2 text-[15.5px] text-muted">
                from {receipt.gift.name} · {new Date(receipt.gift.at).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}
              </div>
            </div>
            <a
              href={explorerTx(receipt.gift.sig)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#9b87f5]/50 px-4 py-2 text-[15px] text-[#d4caff] transition hover:bg-[#9b87f5]/10"
            >
              See it on Solana ↗
            </a>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-3">
              <Stat label="Still in the pool, ready for the next family" value={dollars(receipt.remainingCents)} />
              <Stat label="Helped families so far" value={dollars(receipt.gift.cents - receipt.remainingCents)} />
              <p className="text-[14.5px] text-faint">Shared pool: each family release draws your fair share.</p>
            </div>
            <div>
              <div className="text-[16px] font-medium">Where it went</div>
              {receipt.uses.length === 0 ? (
                <p className="mt-2 text-[17px] text-muted">Not used yet. It appears here the moment a family is helped.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {receipt.uses.map((u) => (
                    <li key={u.sig} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <div className="text-[16px]">A family in West Altadena · {KIND_LABEL[u.kind] ?? "evacuation aid"}</div>
                        <div className="mt-0.5 text-[14px] text-faint">
                          {dollars(u.fromYouCents)} of their {dollars(u.totalCents)} came from you · bank-checked on Nessie
                          {u.nessieTx ? ` (${u.nessieTx.slice(0, 12)}…)` : ""} ·{" "}
                          <a href={explorerTx(u.sig)} target="_blank" rel="noreferrer" className="text-[#b9a8ff] hover:underline">
                            on-chain ↗
                          </a>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[17px] tabular-nums text-[#d4caff]">{dollars(u.fromYouCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="mt-10">
        <SolanaPool pool={money.pool} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel rounded-3xl p-6">
          <h2 className="text-[21px] font-medium">Recent gifts</h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-[15.5px] text-faint">Be the first public gift tonight.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-[15.5px]">{d.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-mono tabular-nums">{dollars(d.cents)}</span>
                    <a href={explorerTx(d.sig)} target="_blank" rel="noreferrer" className="text-[14px] text-[#b9a8ff] hover:underline">
                      ↗
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="panel rounded-3xl p-6">
          <h2 className="text-[24px] font-medium">Your gift never pays for</h2>
          <ul className="mt-3 space-y-2 text-[18px] text-muted">
            <li>Vans, drivers or fuel</li>
            <li>Anyone outside the zone</li>
            <li>Anything but evacuation</li>
          </ul>
          <Link href="/relief" className="mt-4 inline-block text-[15.5px] text-fg underline decoration-white/30 underline-offset-4">
            See the whole relief fund →
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink/40 px-4 py-3.5">
      <div className="text-[14px] text-muted">{label}</div>
      <div className="mt-1 font-mono text-[26px] tabular-nums">{value}</div>
    </div>
  );
}
