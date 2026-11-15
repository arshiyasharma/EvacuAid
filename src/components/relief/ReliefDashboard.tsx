"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NavLinks } from "@/components/NavLinks";
import { ResetDrill } from "@/components/ResetDrill";
import { BudgetSandbox } from "./BudgetSandbox";
import { HistoryTab } from "./HistoryTab";
import { LiveFeed } from "./LiveFeed";
import { TigerPanel } from "./TigerPanel";
import { MoneyFlows } from "./MoneyFlows";
import { SolanaPool } from "./SolanaPool";
import { LiveTag, Logo } from "@/components/ui";
import { dollars, explorerTx, useMoney, type MoneyState } from "@/components/console/useMoney";
import { liveAction } from "@/components/console/useLive";
import { advise, PLANS, type Advice, type Plan } from "@/lib/budget";
import { forecastFund, type ForecastResult } from "@/lib/forecast";
import { clockLabel, REPLAY_END, REPLAY_START } from "@/lib/replay/eaton";
import { householdsAt } from "@/lib/replay/households";

const MINUTE = 60_000;
const CATS = [
  { key: "gas", label: "Gas", color: "var(--color-leaving)" },
  { key: "lodging", label: "Rooms", color: "var(--color-out)" },
  { key: "food", label: "Food", color: "var(--color-silent)" },
  { key: "pharmacy", label: "Pharmacy", color: "#c58bff" },
  { key: "transit", label: "Transit", color: "#7ee0d8" },
];

type Tab = "overview" | "plan" | "ledger" | "history";

export function ReliefDashboard() {
  const money = useMoney(4000);
  const [tab, setTab] = useState<Tab>("overview");
  const [at, setAt] = useState(REPLAY_START + 60 * MINUTE);
  const [hours, setHours] = useState(6);
  const [planKey, setPlanKey] = useState("asked");

  const available = money.fund?.availableCents ?? 0;
  const paidKey = money.stipends
    .filter((s) => s.decision === "approved")
    .map((s) => s.householdId)
    .join(",");

  // One Monte Carlo per plan, shared by every tab.
  const forecasts = useMemo(() => {
    const paid = new Set(paidKey.split(","));
    const households = householdsAt(at).map((h) => ({
      fireEta: h.fireEta,
      lowIncome: h.profile.lowIncome,
      paid: paid.has(h.id),
    }));
    return Object.fromEntries(
      PLANS.map((p) => [
        p.key,
        forecastFund({
          now: at,
          horizonHours: hours,
          availableCents: available + p.extraCents,
          runs: 2000,
          policy: p.policy,
          households,
        }),
      ]),
    ) as Record<string, ForecastResult>;
  }, [at, hours, available, paidKey]);

  const plan = PLANS.find((p) => p.key === planKey)!;
  const advice = advise(available, forecasts);
  const sandboxHouseholds = useMemo(() => {
    const paid = new Set(paidKey.split(","));
    return householdsAt(at).map((h) => ({
      fireEta: h.fireEta,
      lowIncome: h.profile.lowIncome,
      paid: paid.has(h.id),
    }));
  }, [at, paidKey]);

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
        <div className="flex items-center gap-4">
          {money.run && <span className="rounded-full border border-line-strong px-3 py-1 font-mono text-[14px]">Run {money.run}</span>}
          {money.operator && <ResetDrill onDone={money.refresh} />}
          <LiveTag>Live from Nessie</LiveTag>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-4 rounded-2xl border border-line bg-white/[0.02] p-1.5">
        {(
          [
            ["overview", "Overview"],
            ["plan", "Budget plan"],
            ["ledger", "Ledger"],
            ["history", "History"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-xl py-3 text-[17px] transition ${tab === k ? "bg-fg font-medium text-ink" : "text-muted hover:text-fg"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Overview
          money={money}
          onRefresh={money.refresh}
          forecast={forecasts[planKey]}
          advice={advice}
          simAt={at}
          plan={plan}
          hours={hours}
          onPlan={() => setTab("plan")}
        />
      )}
      {tab === "plan" && (
        <BudgetPlan
          forecasts={forecasts}
          planKey={planKey}
          onPlan={setPlanKey}
          available={available}
          at={at}
          onAt={setAt}
          hours={hours}
          onHours={setHours}
        />
      )}
      {tab === "plan" && (
        <div className="mt-6">
          <BudgetSandbox now={at} hours={hours} available={available} households={sandboxHouseholds} />
        </div>
      )}
      {tab === "ledger" && <Ledger money={money} />}
      {tab === "history" && <HistoryTab money={money} />}
    </div>
  );
}

// ---------- Overview ----------

function Overview({
  money,
  onRefresh,
  forecast,
  advice,
  simAt,
  plan,
  hours,
  onPlan,
}: {
  money: MoneyState;
  onRefresh: () => void;
  forecast: ForecastResult;
  advice: Advice;
  simAt: number;
  plan: Plan;
  hours: number;
  onPlan: () => void;
}) {
  const [seeding, setSeeding] = useState(false);
  const paid = money.stipends.filter((s) => s.decision === "approved");
  const blocked = money.stipends.filter((s) => s.decision === "declined");
  const held = money.stipends.filter((s) => s.decision === "held");
  const start = money.fund?.startingCents ?? 120_000_00;
  const paidCents = paid.reduce((a, s) => a + s.amountCents, 0);
  const balance = start - paidCents;
  const lasts = 1 - forecast.shortfallChance;

  async function seed() {
    setSeeding(true);
    try {
      await liveAction("/api/bank/demo");
      onRefresh();
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="rise mt-10 space-y-6">
      <section>
        <div className="font-mono text-[72px] font-light leading-none tabular-nums tracking-tight sm:text-[92px]">
          {money.fund ? dollars(balance) : "—"}
        </div>
        <div className="mt-3 text-[19px] text-muted">
          Left in the relief fund · {dollars(start - balance)} out to {paid.length} families
        </div>
        {money.error && !money.fund && <div className="mt-2 text-[16px] text-help">{money.error}</div>}
        {money.operator && (
          <button
            type="button"
            onClick={seed}
            disabled={seeding}
            className="mt-6 rounded-full bg-fg px-5 py-2.5 text-[16px] font-medium text-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {seeding ? "Running it live on Nessie and Solana…" : "Run a demo night (live transactions)"}
          </button>
        )}
      </section>

      <WhereItMoves repaidCents={money.fund?.bridgeCents ?? 0} />

      <LiveFeed items={money.activity} limit={10} />

      <button
        type="button"
        onClick={onPlan}
        className="block w-full rounded-3xl border border-line bg-[#0d0d10] p-7 text-left transition hover:border-line-strong"
      >
        <div className="flex items-center justify-between">
          <span className="label">Next {hours} hours</span>
          <span className="rounded-full bg-out/15 px-3 py-1 text-[14.5px] font-medium text-out">
            Plan {plan.letter} · {plan.name}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4">
          <span className={`font-mono text-[72px] font-light leading-none tabular-nums ${lasts < 0.9 ? "text-help" : "text-out"}`}>
            {Math.round(lasts * 100)}%
          </span>
          <span className="text-[20px]">chance the money lasts the night</span>
        </div>
        <div className={`mt-4 text-[19px] font-medium ${advice.tone === "ok" ? "text-out" : advice.tone === "watch" ? "text-silent" : "text-help"}`}>
          {advice.headline}
        </div>
        <p className="mt-1 max-w-[720px] text-[16.5px] leading-relaxed text-muted">{advice.detail}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[15px] text-faint">
          <span>
            {(forecast.runs * PLANS.length).toLocaleString()} nights simulated from {clockLabel(simAt)} · re-run whenever money moves
          </span>
          <span className="text-muted">See the plans and the budget →</span>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Paid to families" value={dollars(paidCents)} sub={`${paid.length} payments`} tone="text-out" />
        <Kpi
          label="Fraud stopped"
          value={dollars(blocked.reduce((a, s) => a + s.amountCents, 0))}
          sub={`${blocked.length} claims blocked`}
          tone="text-help"
        />
        <Kpi label="Waiting on a person" value={String(held.length)} sub="flagged for review" tone="text-silent" />
        <Kpi
          label="Spent on evacuating"
          value={dollars((money.spends ?? []).filter((s) => s.approved).reduce((a, s) => a + s.cents, 0))}
          sub="gas, rooms, food"
          tone="text-fg"
        />
      </div>

      <MoneyFlows money={money} />

      <SolanaPool pool={money.pool} />

      <Card title="Where it was spent" sub="Relief cards only work for evacuating.">
        <Spending money={money} />
      </Card>

      <TigerPanel />
    </div>
  );
}

// ---------- Budget plan ----------

function BudgetPlan({
  forecasts,
  planKey,
  onPlan,
  available,
  at,
  onAt,
  hours,
  onHours,
}: {
  forecasts: Record<string, ForecastResult>;
  planKey: string;
  onPlan: (k: string) => void;
  available: number;
  at: number;
  onAt: (t: number) => void;
  hours: number;
  onHours: (h: number) => void;
}) {
  const plan = PLANS.find((p) => p.key === planKey)!;
  const f = forecasts[planKey];
  const budget = available + plan.extraCents;
  const runsOut = f.timeline.find((t) => t.p90Cents > budget);
  const runsOutLikely = f.timeline.find((t) => t.p50Cents > budget);

  return (
    <div className="rise mt-10 space-y-6">
      <section className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <div className="text-[19px] text-muted">If the fire keeps spreading like it is, starting {clockLabel(at)}</div>
          <div className="mt-2 text-[34px] font-medium leading-tight tracking-[-0.01em]">
            {runsOutLikely
              ? `The money likely runs out around ${clockLabel(runsOutLikely.at)}.`
              : runsOut
                ? `Enough on a normal night. On a bad night it runs out around ${clockLabel(runsOut.at)}.`
                : "Enough money, even on a bad night."}
          </div>
        </div>
        <div className="flex gap-1.5">
          {[2, 4, 6, 12].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onHours(h)}
              className={`rounded-full border px-4 py-2 font-mono text-[16px] transition ${
                h === hours ? "border-fg bg-fg text-ink" : "border-line text-muted hover:text-fg"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </section>

      <Card title="Fund balance, hour by hour" sub={`${f.runs.toLocaleString()} simulated nights of this fire.`}>
        <BurnDown f={f} budget={budget} start={at} />
        <label className="mt-6 block">
          <div className="flex justify-between text-[16px] text-muted">
            <span>Start the forecast at</span>
            <span className="font-mono text-fg">{clockLabel(at)}</span>
          </div>
          <input
            type="range"
            min={REPLAY_START}
            max={REPLAY_END - hours * 60 * MINUTE}
            step={15 * MINUTE}
            value={Math.min(at, REPLAY_END - hours * 60 * MINUTE)}
            onChange={(e) => onAt(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--color-out)]"
          />
        </label>
      </Card>

      <div className="rounded-3xl border border-line bg-[#0d0d10] p-7">
        <div className="label">Plans</div>
        <div className="mt-1 text-[18px] text-muted">Chance the money lasts the next {hours} hours</div>
        <ul className="mt-5 space-y-2">
          {PLANS.map((p) => {
            const lasts = 1 - forecasts[p.key].shortfallChance;
            const on = p.key === planKey;
            return (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => onPlan(p.key)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${on ? "border-out/50 bg-out/[0.06]" : "border-line hover:bg-white/[0.03]"}`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg font-mono text-[17px] ${on ? "bg-out text-ink" : "bg-white/[0.08]"}`}
                    >
                      {p.letter}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[18px]">{p.name}</div>
                      <div className="text-[15px] text-muted">{p.what}</div>
                    </div>
                    <span className={`font-mono text-[24px] tabular-nums ${lasts < 0.9 ? "text-help" : "text-out"}`}>{Math.round(lasts * 100)}%</span>
                  </div>
                  <div className="ml-[52px] mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${lasts * 100}%`,
                        background: lasts < 0.9 ? "var(--color-help)" : "var(--color-out)",
                      }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="In the fund now" value={dollars(available)} sub="available on Nessie" tone="text-fg" />
        <Kpi label="Likely need" value={dollars(f.p50Cents)} sub="half of nights need less" tone="text-silent" />
        <Kpi label="Bad night" value={dollars(f.p90Cents)} sub="1 in 10 nights need more" tone="text-help" />
        <Kpi
          label={budget >= f.p90Cents ? "Left on a bad night" : "Short on a bad night"}
          value={dollars(Math.abs(budget - f.p90Cents))}
          sub={plan.extraCents ? "with the Solana pool" : "county fund only"}
          tone={budget >= f.p90Cents ? "text-out" : "text-help"}
        />
      </div>
    </div>
  );
}

/** Balance over the night: the likely path, the bad-night path, and where zero is. */
function BurnDown({ f, budget, start }: { f: ForecastResult; budget: number; start: number }) {
  const W = 1000;
  const Hh = 300;
  const pad = { l: 8, r: 8, t: 24, b: 40 };
  const pts = [{ at: start, p10Cents: 0, p50Cents: 0, p90Cents: 0 }, ...f.timeline];
  const minBal = Math.min(0, budget - (pts[pts.length - 1]?.p90Cents ?? 0));
  const maxBal = Math.max(budget, 1);
  const x = (i: number) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const y = (bal: number) => pad.t + ((maxBal - bal) / (maxBal - minBal || 1)) * (Hh - pad.t - pad.b);
  const step = (key: "p10Cents" | "p50Cents" | "p90Cents") =>
    pts.map((p, i) => `${i === 0 ? "M" : "H"}${x(i)}${i === 0 ? ` ${y(budget - p[key])}` : ` V${y(budget - p[key])}`}`).join(" ");
  const last = pts[pts.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${Hh}`} className="h-[300px] w-full" preserveAspectRatio="none" role="img" aria-label="Projected fund balance">
        {minBal < 0 && (
          <>
            <rect x={0} y={y(0)} width={W} height={Hh - pad.b - y(0)} fill="rgb(255 77 58 / 0.07)" />
            <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--color-help)" strokeDasharray="6 6" strokeWidth={1.5} />
          </>
        )}
        <path d={step("p90Cents")} fill="none" stroke="var(--color-help)" strokeWidth={2.5} strokeDasharray="8 6" vectorEffect="non-scaling-stroke" />
        <path d={step("p50Cents")} fill="none" stroke="var(--color-fg)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(budget - p.p50Cents)}
            r={i === 0 || i === pts.length - 1 ? 7 : 5}
            fill={i === pts.length - 1 ? "var(--color-out)" : i === 0 ? "var(--color-fg)" : "var(--color-ink)"}
            stroke="var(--color-fg)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[14px] text-muted">
        {pts.map((p, i) => (
          <span key={i} className={i % Math.ceil(pts.length / 7) === 0 || i === pts.length - 1 ? "" : "hidden sm:inline"}>
            {clockLabel(p.at).replace(":00", "")}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-[16px]">
        <Legend
          line="var(--color-fg)"
          label={budget - last.p50Cents < 0 ? `Likely: short ${dollars(last.p50Cents - budget)}` : `Likely: ${dollars(budget - last.p50Cents)} left`}
        />
        <Legend
          line="var(--color-help)"
          dashed
          label={
            budget - last.p90Cents < 0 ? `Bad night: short ${dollars(last.p90Cents - budget)}` : `Bad night: ${dollars(budget - last.p90Cents)} left`
          }
        />
        {minBal < 0 && <Legend line="var(--color-help)" dashed thin label="Runs out" />}
      </div>
    </div>
  );
}

function Legend({ line, label, dashed, thin }: { line: string; label: string; dashed?: boolean; thin?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-muted">
      <svg width="26" height="8" aria-hidden>
        <line x1="0" x2="26" y1="4" y2="4" stroke={line} strokeWidth={thin ? 1.5 : 3} strokeDasharray={dashed ? "5 4" : undefined} />
      </svg>
      {label}
    </span>
  );
}

// ---------- Ledger ----------

function Ledger({ money }: { money: MoneyState }) {
  const start = money.fund?.startingCents ?? 120_000_00;
  // Oldest first so the running balance reads top to bottom.
  const events = [...money.stipends].sort((a, b) => a.at - b.at);
  const rows = events.map((s, i) => {
    const change = s.decision === "approved" ? -s.amountCents : 0;
    const bal = start - events.slice(0, i + 1).reduce((a, e) => a + (e.decision === "approved" ? e.amountCents : 0), 0);
    const why = s.checks.find((c) => c.result === "fail") ?? s.checks.find((c) => c.result === "flag");
    return { s, change, bal, why };
  });

  return (
    <div className="rise mt-10 space-y-6">
      <LiveFeed items={money.activity} limit={25} />

      <div className="rounded-3xl border border-line bg-white/[0.02] p-6 sm:p-7">
        <h2 className="text-[24px] font-medium">How to read this ledger</h2>
        <ul className="mt-3 grid gap-2 text-[18px] text-muted md:grid-cols-3">
          <li>
            <span className="text-fg">Live:</span> updates seconds after an approval.
          </li>
          <li>
            <span className="text-fg">Blocked = $0:</span> the reason is listed.
          </li>
          <li>
            <span className="text-fg">Private:</span> real residents stay anonymous.
          </li>
        </ul>
      </div>

      <Card
        title="Every change to the fund"
        sub="What moved, what didn't, and why. Straight from Nessie."
        action={
          rows.some((r) => r.change) &&
          money.operator && (
            <button
              type="button"
              onClick={() => exportFema(money)}
              className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-[15.5px] transition hover:bg-white/[0.06]"
            >
              FEMA export ↓
            </button>
          )
        }
      >
        <ul className="divide-y divide-line">
          <Row title="Opening balance" detail="County evacuation relief fund" amount={`+${dollars(start)}`} tone="text-fg" balance={start} />
          {rows.map(({ s, change, bal, why }) => (
            <Row
              key={`${s.householdId}:${s.transactionId ?? s.at}`}
              title={s.decision === "approved" ? `Aid to ${s.label}` : s.decision === "held" ? `Waiting: ${s.label}` : `Blocked: ${s.label}`}
              detail={
                s.decision === "approved"
                  ? `All ${s.checks.length} checks passed · ${s.settlement === "completed" ? "paid" : "settling"} · ${
                      s.funding?.source === "solana"
                        ? s.funding.status === "released"
                          ? "funded by Solana donors"
                          : "releasing from Solana"
                        : "county fund"
                    }`
                  : (why?.detail ?? "")
              }
              link={s.funding?.sig ? explorerTx(s.funding.sig) : undefined}
              amount={change ? `−${dollars(-change)}` : "$0"}
              tone={s.decision === "approved" ? "text-fg" : s.decision === "held" ? "text-silent" : "text-help"}
              struck={s.decision === "declined"}
              balance={bal}
              time={new Date(s.at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            />
          ))}
        </ul>
        {rows.length === 0 && <p className="mt-4 text-[16px] text-faint">No requests yet. Open the Overview to run a demo night.</p>}
      </Card>

      <Card
        title="On the relief cards"
        sub="Demo swipes on Nessie's merchant API: real purchases at test merchants (gas, hotels, groceries, and one electronics store). Evacuation categories go through; anything else is declined at the register."
      >
        {(money.spends ?? []).length === 0 ? (
          <p className="text-[16px] text-faint">No card purchases yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(money.spends ?? []).map((s) => (
              <Row
                key={s.transactionId}
                title={s.merchant}
                detail={`${s.label} · ${s.category}${s.approved ? "" : " · not an evacuation expense"}`}
                amount={dollars(s.cents)}
                tone={s.approved ? "text-fg" : "text-help"}
                struck={!s.approved}
                time={new Date(s.at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Row({
  title,
  detail,
  amount,
  tone,
  struck,
  balance,
  time,
  link,
}: {
  title: string;
  detail: string;
  amount: string;
  tone: string;
  struck?: boolean;
  balance?: number;
  time?: string;
  link?: string;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="text-[17.5px]">{title}</div>
        <div className="mt-0.5 text-[15px] text-muted">
          {time && <span className="font-mono">{time} · </span>}
          {detail}
          {link && (
            <>
              {" · "}
              <a href={link} target="_blank" rel="noreferrer" className="text-[#b9a8ff] hover:underline">
                on-chain ↗
              </a>
            </>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-mono text-[18px] tabular-nums ${tone} ${struck ? "line-through opacity-80" : ""}`}>{amount}</div>
        {balance !== undefined && <div className="mt-0.5 font-mono text-[14px] text-faint">{dollars(balance)}</div>}
      </div>
    </li>
  );
}

// ---------- shared ----------

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="panel rounded-2xl px-5 py-5">
      <div className="text-[15.5px] text-muted">{label}</div>
      <div className={`mt-1.5 font-mono text-[30px] tabular-nums leading-none tracking-tight ${tone}`}>{value}</div>
      <div className="mt-2 text-[14.5px] text-faint">{sub}</div>
    </div>
  );
}

function Card({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel rounded-3xl p-6 sm:p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[23px] font-medium tracking-[-0.01em]">{title}</h2>
          {sub && <p className="mt-1 text-[16.5px] text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Spending({ money }: { money: MoneyState }) {
  const spends = money.spends ?? [];
  const paidCents = money.stipends.filter((s) => s.decision === "approved").reduce((a, s) => a + s.amountCents, 0);
  const spentCents = spends.filter((s) => s.approved).reduce((a, s) => a + s.cents, 0);
  const rows = [
    ...CATS.map((c) => ({
      ...c,
      cents: spends.filter((s) => s.approved && s.category === c.key).reduce((a, s) => a + s.cents, 0),
    })).filter((c) => c.cents > 0),
    {
      key: "left",
      label: "Not spent yet",
      color: "rgb(255 255 255 / 0.3)",
      cents: Math.max(0, paidCents - spentCents),
    },
  ];
  const max = Math.max(1, ...rows.map((r) => r.cents));
  if (paidCents === 0) return <p className="text-[16px] text-faint">Nothing paid out yet.</p>;
  return (
    <div className="space-y-4">
      {rows.map((c) => (
        <div key={c.key}>
          <div className="flex justify-between text-[16.5px]">
            <span>{c.label}</span>
            <span className="font-mono tabular-nums">{dollars(c.cents)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${(c.cents / max) * 100}%`,
                background: c.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** FEMA Public Assistance Category B: itemized evacuation and sheltering costs. */
function exportFema(money: MoneyState) {
  const rows = [
    ["date", "household", "type", "description", "amount_usd", "nessie_transaction", "decision", "fema_share_75pct_usd"],
    ...money.stipends
      .filter((s) => s.decision === "approved")
      .map((s) => [
        new Date(s.at).toISOString(),
        s.label,
        "Evacuation stipend",
        "Relief fund to relief card",
        (s.amountCents / 100).toFixed(2),
        s.transactionId ?? "",
        s.decision,
        ((s.amountCents * 0.75) / 100).toFixed(2),
      ]),
    ...(money.spends ?? []).map((s) => [
      new Date(s.at).toISOString(),
      s.label,
      `Relief card: ${s.category}`,
      s.merchant,
      (s.cents / 100).toFixed(2),
      s.transactionId,
      s.approved ? "approved" : "declined",
      "",
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "evacuaid-fema-category-b.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- What moves where ----------

const RAILS: { name: string; tone: string; dot: string; moves: string[] }[] = [
  {
    name: "Solana",
    tone: "text-[#b9a8ff]",
    dot: "bg-[#b9a8ff]",
    moves: ["Donations in", "Pays the county back", "Pool balance"],
  },
  {
    name: "Nessie",
    tone: "text-leaving",
    dot: "bg-leaving",
    moves: ["Aid to relief cards", "Bank checks", "Card swipes", "Trip bills", "Donor repayments in"],
  },
  {
    name: "Tiger Data",
    tone: "text-silent",
    dot: "bg-silent",
    moves: ["Every text, case and payment, by time"],
  },
];

function WhereItMoves({ repaidCents }: { repaidCents: number }) {
  return (
    <div>
      <p className="mb-3 text-[16px] text-muted">
        Nessie pays the family first. Solana then pays the county back from donors
        {repaidCents > 0 && <span className="text-fg"> · {dollars(repaidCents)} repaid so far</span>}.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {RAILS.map((r) => (
          <div key={r.name} className="rounded-2xl border border-line bg-white/[0.02] p-4">
            <div className={`flex items-center gap-2 text-[15px] font-medium ${r.tone}`}>
              <span className={`size-2 rounded-full ${r.dot}`} aria-hidden />
              {r.name}
            </div>
            <ul className="mt-2 space-y-1 text-[15.5px] text-muted">
              {r.moves.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
