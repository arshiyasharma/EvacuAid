"use client";

import { useMemo, useState } from "react";
import { dollars } from "@/components/console/useMoney";
import { POOL_PLEDGED_CENTS } from "@/lib/budget";
import { forecastFund, type ForecastResult, type Policy } from "@/lib/forecast";

type Household = { fireEta: number; lowIncome: boolean; paid: boolean };

type Knobs = { aid: number; nights: number; shelter: number; speed: number; pool: boolean };

const BASELINE: Knobs = { aid: 770_00, nights: 99, shelter: 0, speed: 1, pool: false };
const TARGET = 0.9; // chance the money lasts

function run(k: Knobs, base: { now: number; hours: number; available: number; households: Household[] }, runs: number): ForecastResult {
  const policy: Partial<Policy> = { stipendCents: k.aid, maxNights: k.nights, shelterShare: k.shelter };
  return forecastFund({
    now: base.now,
    horizonHours: base.hours,
    availableCents: base.available + (k.pool ? POOL_PLEDGED_CENTS : 0),
    households: base.households,
    policy,
    speedScale: k.speed,
    runs,
  });
}

/** Try budgets before the night does: change the rules, watch the odds, let it find the best plan. */
export function BudgetSandbox({ now, hours, available, households }: { now: number; hours: number; available: number; households: Household[] }) {
  const [k, setK] = useState<Knobs>(BASELINE);
  const [best, setBest] = useState<{ knobs: Knobs; f: ForecastResult } | null>(null);
  const [searching, setSearching] = useState(false);
  const base = useMemo(() => ({ now, hours, available, households }), [now, hours, available, households]);

  const f = useMemo(() => run(k, base, 1000), [k, base]);
  const baseline = useMemo(() => run({ ...BASELINE, speed: k.speed, pool: k.pool }, base, 1000), [k.speed, k.pool, base]);

  const lasts = 1 - f.shortfallChance;
  const saved = baseline.p50Cents - f.p50Cents;
  const perFamily = f.familiesP50 ? f.p50Cents / f.familiesP50 : 0;

  function optimize() {
    setSearching(true);
    // Let the button repaint before the search runs.
    setTimeout(() => {
      // Most generous first: highest aid, then the fewest cuts to rooms.
      const shapes: [number, number][] = [
        [0, 99],
        [0, 2],
        [0.3, 99],
        [0.3, 2],
        [0.6, 2],
        [0.6, 1],
        [0.8, 1],
      ];
      let found: { knobs: Knobs; f: ForecastResult } | null = null;
      outer: for (let aid = 770_00; aid >= 150_00; aid -= 40_00) {
        for (const [shelter, nights] of shapes) {
          const knobs = { aid, nights, shelter, speed: k.speed, pool: k.pool };
          const r = run(knobs, base, 600);
          if (1 - r.shortfallChance >= TARGET) {
            found = { knobs, f: r };
            break outer;
          }
        }
      }
      setBest(found);
      setSearching(false);
    }, 30);
  }

  const set = (patch: Partial<Knobs>) => {
    setK((prev) => ({ ...prev, ...patch }));
    setBest(null);
  };

  return (
    <div className="panel rounded-3xl p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[23px] font-medium tracking-[-0.01em]">Try a budget</h2>
          <p className="mt-1 max-w-[620px] text-[16.5px] text-muted">
            Change how much each family gets and how rooms are handled. Every change re-runs 1,000 nights of this fire.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setK(BASELINE);
              setBest(null);
            }}
            className="rounded-full border border-line-strong px-4 py-2.5 text-[16px] text-muted transition hover:text-fg"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={optimize}
            disabled={searching}
            className="rounded-full bg-fg px-5 py-2.5 text-[16px] font-medium text-ink transition hover:bg-white disabled:opacity-50"
          >
            {searching ? "Searching plans…" : "Find the best plan"}
          </button>
        </div>
      </div>

      <div className="mt-7 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Slider
            label="Aid per family"
            value={k.aid}
            min={150_00}
            max={770_00}
            step={10_00}
            show={dollars(k.aid)}
            onChange={(v) => set({ aid: v })}
            hint="$770 is FEMA's amount. Gas alone is about $150."
          />
          <Slider
            label="Families sent to the free shelter first"
            value={k.shelter}
            min={0}
            max={0.8}
            step={0.1}
            show={`${Math.round(k.shelter * 100)}%`}
            onChange={(v) => set({ shelter: v })}
            hint="Pets welcome at the Pasadena Civic Center, so most families can go."
          />
          <Chips
            label="Paid room nights, at most"
            value={k.nights}
            options={[
              [0, "None"],
              [1, "1"],
              [2, "2"],
              [99, "As asked"],
            ]}
            onChange={(v) => set({ nights: v })}
          />
          <Chips
            label="How fast the fire spreads"
            value={k.speed}
            options={[
              [0.75, "Slower"],
              [1, "As observed"],
              [1.5, "1.5×"],
              [2, "2× worse"],
            ]}
            onChange={(v) => set({ speed: v })}
          />
          <button
            type="button"
            onClick={() => set({ pool: !k.pool })}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
              k.pool ? "border-[#9b87f5]/60 bg-[#9b87f5]/10" : "border-line hover:bg-white/[0.03]"
            }`}
          >
            <span>
              <span className="block text-[16.5px]">Release the Solana donor pool</span>
              <span className="block text-[14.5px] text-faint">+{dollars(POOL_PLEDGED_CENTS)} pledged for this incident</span>
            </span>
            <span className={`size-5 rounded-full border-2 ${k.pool ? "border-[#9b87f5] bg-[#9b87f5]" : "border-line-strong"}`} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white/[0.02] p-5">
            <div className="text-[15.5px] text-muted">Chance the money lasts</div>
            <div className={`mt-1 font-mono text-[56px] font-light leading-none tabular-nums ${lasts >= TARGET ? "text-out" : "text-help"}`}>
              {Math.round(lasts * 100)}%
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-[15px]">
              <Out label="Families helped" value={String(f.familiesP50)} />
              <Out label="Average per family" value={dollars(perFamily)} />
              <Out label="Likely need" value={dollars(f.p50Cents)} />
              <Out label="Bad night" value={dollars(f.p90Cents)} tone="text-help" />
            </div>
            <div className={`mt-4 border-t border-line pt-3 text-[15.5px] ${saved > 0 ? "text-out" : saved < 0 ? "text-help" : "text-muted"}`}>
              {saved === 0
                ? "Same as paying $770 and every room asked for."
                : saved > 0
                  ? `Saves ${dollars(saved)} on a typical night vs. paying $770 and every room asked for.`
                  : `Costs ${dollars(-saved)} more than paying $770 and every room asked for.`}
            </div>
          </div>

          {best && (
            <div className="rise rounded-2xl border border-out/35 bg-out/[0.06] p-5">
              <div className="text-[17px] font-medium text-out">Most generous plan that lasts {Math.round(TARGET * 100)}%+</div>
              <ul className="mt-2 space-y-1 text-[15.5px]">
                <li>{dollars(best.knobs.aid)} per family</li>
                <li>{Math.round(best.knobs.shelter * 100)}% to the free shelter first</li>
                <li>{best.knobs.nights >= 99 ? "Room nights as asked" : `Up to ${best.knobs.nights} paid night${best.knobs.nights === 1 ? "" : "s"}`}</li>
              </ul>
              <div className="mt-2 text-[15px] text-muted">
                Lasts {Math.round((1 - best.f.shortfallChance) * 100)}% of nights · helps {best.f.familiesP50} families · saves{" "}
                {dollars(Math.max(0, baseline.p50Cents - best.f.p50Cents))}
              </div>
              <button
                type="button"
                onClick={() => setK(best.knobs)}
                className="mt-3 rounded-full border border-out/50 px-4 py-1.5 text-[15px] text-out transition hover:bg-out/10"
              >
                Use this plan
              </button>
            </div>
          )}
          {best === null && !searching && (
            <p className="text-[14.5px] text-faint">
              &quot;Find the best plan&quot; searches up to 98 combinations and keeps the most generous one that still lasts 90% of nights.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-[16px]">
        <span>{props.label}</span>
        <span className="font-mono">{props.show}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-out)]"
      />
      {props.hint && <div className="text-[14px] text-faint">{props.hint}</div>}
    </label>
  );
}

function Chips({ label, value, options, onChange }: { label: string; value: number; options: [number, string][]; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-[16px]">{label}</div>
      <div className="mt-2 flex gap-1.5">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex-1 rounded-full border py-2 text-[15px] transition ${v === value ? "border-fg bg-fg text-ink" : "border-line text-muted hover:text-fg"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Out({ label, value, tone = "text-fg" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="font-sans text-[13.5px] text-faint">{label}</div>
      <div className={`tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
