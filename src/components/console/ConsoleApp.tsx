"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLinks } from "@/components/NavLinks";
import { ResetDrill } from "@/components/ResetDrill";
import { SignOut } from "@/components/SignOut";
import { StoryOverlay } from "./StoryOverlay";
import { LiveTag, Logo } from "@/components/ui";
import { PLANS } from "@/lib/budget";
import { forecastFund, type ForecastResult } from "@/lib/forecast";
import { rankHouseholds } from "@/lib/priority";
import { FIRE, REAL_WEST_ALTADENA_ORDER, REPLAY_END, REPLAY_START, firePointsAt, hazardAt } from "@/lib/replay/eaton";
import { FLEET, SHELTER } from "@/lib/replay/fleet";
import { vehicleAt } from "@/lib/ops/trips";
import { applyOperator, FIRST_ALERT, countStatuses, householdsAt, type HouseholdView, type SimCase } from "@/lib/replay/households";
import { recommendVehicle, vehiclesBusy } from "@/lib/ops/recommend";
import { Clock } from "./Clock";
import { HouseholdDrawer } from "./HouseholdDrawer";
import type { FC } from "./LiveMap";
import { LiveMap } from "./LiveMap";
import { RosterControl } from "./RosterControl";
import { SidePanel } from "./SidePanel";
import { Timeline } from "./Timeline";
import { MoneyPanel } from "./MoneyPanel";
import { liveAction, useLive } from "./useLive";
import { useMoney } from "./useMoney";
import { useReplayClock } from "./useReplayClock";

const MINUTE = 60_000;

export type ConsoleHousehold = HouseholdView & { live?: boolean; name?: string; summary?: string; case?: SimCase };

export function ConsoleApp() {
  const clock = useReplayClock(REPLAY_START, REPLAY_END);
  const live = useLive();
  const operator = live.operator === true;
  const money = useMoney();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"priority" | "money">("priority");

  // Recompute the world once per replay minute, not every frame.
  const minute = Math.floor(clock.t / MINUTE) * MINUTE;

  const dispatches = live.ops?.dispatches;
  const opsMessages = live.ops?.messages;
  const approvalsKey = money.stipends.map((s) => `${s.householdId}:${s.decision}:${s.replayAt ?? ""}`).join("|");

  const world = useMemo(() => {
    // The replay, plus whatever you (the operator) did to your sector's cases.
    const sim: ConsoleHousehold[] = applyOperator(
      householdsAt(minute),
      {
        dispatches: dispatches ?? [],
        messages: opsMessages ?? [],
        approvals: money.stipends
          .filter((s) => s.kind)
          .map((s) => ({ householdId: s.householdId, decision: s.decision, kind: s.kind!, cents: s.amountCents, replayAt: s.replayAt })),
      },
      minute,
    );
    // Real phones are always in your sector, at the top.
    const real: ConsoleHousehold[] = live.households.map((h) => ({
      ...h,
      fireEta: 0,
      alertAt: h.lastUpdate,
      live: true,
      sector: "you",
      story: "live",
      doorKnock: h.conv?.doorKnock,
      leftBehind: h.conv?.leftBehind,
      case: h.conv?.case as SimCase | undefined,
    }));
    const households = [...real, ...sim];
    const hazard = hazardAt(minute);
    const ranked = rankHouseholds(households, hazard);
    const byId = new Map(households.map((h) => [h.id, h]));
    const busy = vehiclesBusy(dispatches ?? [], byId, minute);
    // Map routes: vehicles you've actually sent that are still out.
    const assignments = (dispatches ?? [])
      .filter((d) => busy.has(d.vehicleId) && busy.get(d.vehicleId) === d.householdId)
      .map((d) => ({ householdId: d.householdId, vehicleId: d.vehicleId, etaMin: d.etaMin }));
    // EvacuAid's suggestion for each open ride / door-knock case in your sector.
    const suggestions = new Map<string, ReturnType<typeof recommendVehicle>>();
    const taken = new Set(busy.keys());
    for (const r of ranked) {
      const h = byId.get(r.householdId);
      if (!h || h.sector !== "you" || !h.case || h.case.status !== "review" || h.case.kind === "aid") continue;
      const rec = recommendVehicle(h.location, Boolean(h.case.wheelchair || h.needs.mobility), taken);
      suggestions.set(h.id, rec);
      if (rec) taken.add(rec.vehicleId);
    }
    return { households, ranked, byId, assignments, busy, suggestions, counts: countStatuses(households) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minute, live.households, dispatches, opsMessages, approvalsKey]);

  // Monte Carlo forecast, refreshed every 15 replay minutes (it runs 2,000 simulated nights).
  const FORECAST_HOURS = 6;
  const bucket = Math.floor(minute / (15 * MINUTE));
  const paidKey = money.stipends.filter((s) => s.decision === "approved").map((s) => s.householdId).join(",");
  const availableCents = money.fund?.availableCents ?? 0;
  // Every plan, re-simulated each 15 replay minutes: 2,000 nights apiece.
  const forecasts = useMemo(() => {
    const paid = new Set(paidKey ? paidKey.split(",") : []);
    const now = bucket * 15 * MINUTE;
    const households = world.households.map((h) => ({ fireEta: h.fireEta || now, lowIncome: h.profile.lowIncome, paid: paid.has(h.id) }));
    return Object.fromEntries(
      PLANS.map((p) => [
        p.key,
        forecastFund({ now, horizonHours: FORECAST_HOURS, availableCents: availableCents + p.extraCents, policy: p.policy, households }),
      ]),
    ) as Record<string, ForecastResult>;
    // world.households changes every minute; the forecast only needs the 15-minute bucket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, paidKey, availableCents]);
  const simAt = bucket * 15 * MINUTE;

  // How bad is it right now: for the money panel's situation line.
  const situation = useMemo(() => {
    const ordered = world.households.filter((h) => h.alerted);
    const stuck = ordered.filter((h) => h.status === "needs_help" || h.status === "no_response");
    const etas = world.ranked
      .filter((r) => {
        const h = world.byId.get(r.householdId);
        return h && h.alerted && (h.status === "needs_help" || h.status === "no_response") && r.etaToHazardMin !== null;
      })
      .map((r) => r.etaToHazardMin as number);
    return {
      ordered: ordered.length,
      needHelp: world.counts.needs_help,
      silent: world.counts.no_response,
      stuck: stuck.length,
      nearestFireMin: etas.length ? Math.min(...etas) : null,
    };
  }, [world]);

  // A reset rewinds the night for everyone watching.
  const lastReset = useRef(live.resetAt ?? null);
  useEffect(() => {
    const r = live.resetAt ?? null;
    if (r && r !== lastReset.current) {
      if (clock.playing) clock.toggle();
      clock.seek(REPLAY_START);
      setSelectedId(null);
    }
    lastReset.current = r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.resetAt]);

  // Follow up with silent homes while an alert is out (server decides who is due).
  const alertOut = live.alertSentAt !== null;
  useEffect(() => {
    if (!alertOut || !operator) return;
    const id = setInterval(() => liveAction("/api/nudge").catch(() => {}), 15_000);
    return () => clearInterval(id);
  }, [alertOut, operator]);

  const fire = useMemo<FC>(() => {
    const pts = firePointsAt(minute);
    return {
      type: "FeatureCollection",
      features: pts.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        // Fresh fire burns hot; it cools over about three hours.
        properties: { heat: Math.max(0.15, 1 - (minute - p.arrival) / (3 * 60 * MINUTE)) },
      })),
    };
  }, [minute]);

  const households = useMemo<FC>(
    () => ({
      type: "FeatureCollection",
      features: world.households.map((h) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [h.location.lng, h.location.lat] },
        properties: { id: h.id, status: h.status, alerted: h.alerted, selected: h.id === selectedId, live: Boolean(h.live) },
      })),
    }),
    [world.households, selectedId],
  );

  // Vehicles move: replay trips on the replay clock, real-phone trips in real time.
  const [now, setNow] = useState(() => Date.now());
  const liveTrips = (dispatches ?? []).some((d) => d.live && now - d.at < 30 * 60_000);
  useEffect(() => {
    if (!liveTrips) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [liveTrips]);

  const { vehicles, routes } = useMemo(() => {
    // Latest trip per vehicle decides where it is.
    const latestTrip = new Map<string, NonNullable<typeof dispatches>[number]>();
    for (const d of dispatches ?? []) {
      const prev = latestTrip.get(d.vehicleId);
      if (!prev || d.at >= prev.at) latestTrip.set(d.vehicleId, d);
    }
    const pos = new Map<string, { at: { lng: number; lat: number }; moving: boolean; target: { lng: number; lat: number } | null }>();
    for (const v of FLEET) {
      const d = latestTrip.get(v.id);
      const h = d ? world.byId.get(d.householdId) : undefined;
      if (!d || !h) {
        pos.set(v.id, { at: v.location, moving: false, target: null });
        continue;
      }
      const r = vehicleAt(d, v.location, h.location, SHELTER.location, d.live ? now : clock.t);
      pos.set(v.id, { at: r.at, moving: r.phase !== "idle", target: r.target });
    }
    const vehicles: FC = {
      type: "FeatureCollection",
      features: FLEET.map((v) => {
        const p = pos.get(v.id)!;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.at.lng, p.at.lat] },
          properties: { id: v.id, moving: p.moving },
        };
      }),
    };
    const routes: FC = {
      type: "FeatureCollection",
      features: FLEET.flatMap((v) => {
        const p = pos.get(v.id)!;
        if (!p.target) return [];
        return [
          {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [p.at.lng, p.at.lat],
                [p.target.lng, p.target.lat],
              ],
            },
            properties: {},
          },
        ];
      }),
    };
    return { vehicles, routes };
  }, [dispatches, world.byId, clock.t, now]);

  const selected = selectedId ? world.byId.get(selectedId) ?? null : null;
  const selectedScore = selectedId ? world.ranked.find((r) => r.householdId === selectedId) ?? null : null;


  return (
    <>
      <header className="relative z-30 flex items-center justify-between border-b border-line px-6">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <span className="h-4 w-px bg-line-strong" />
          <NavLinks />
          <span className="h-4 w-px bg-line-strong" />
          <span className="label text-fg">Eaton fire</span>
        </div>
        <div className="flex items-center gap-6">
          {operator ? (
            <>
              <RosterControl live={live} />
              <ResetDrill onDone={money.refresh} />
              <SignOut />
            </>
          ) : (
            <Link href="/login?next=/console" className="rounded-full border border-line-strong px-4 py-1.5 text-[15.5px] transition hover:bg-white/[0.06]">
              View only · Operator sign in
            </Link>
          )}
          <span className="h-4 w-px bg-line-strong" />
          <LiveTag>Roll call</LiveTag>
          <Clock />
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[1fr_440px]">
        <section className="relative min-h-0 overflow-hidden">
          <div className="bg-dots absolute inset-0" />
          <LiveMap
            fire={fire}
            households={households}
            vehicles={vehicles}
            routes={routes}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(5_5_6/0.85))]" />
          <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-40" />
          <StoryOverlay minute={minute} liveAlertAt={live.alertSentAt} livePhones={live.households.filter((h) => h.alertsOn !== false).length} />

          <div className="pointer-events-none absolute left-6 top-5">
            <div className="text-[18px] font-medium tracking-[0.18em]">WEST ALTADENA</div>
            <div className="mt-1.5 font-mono text-[15px] tracking-[0.06em] text-muted">
              {FIRE.points.length} satellite fire detections · NASA FIRMS
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-5 left-6 flex gap-5">
            {[
              ["Needs help", "var(--color-help)"],
              ["No response", "var(--color-silent)"],
              ["Leaving", "var(--color-leaving)"],
              ["Out", "var(--color-out)"],
              ["Not alerted yet", "#3a3a42"],
            ].map(([label, color]) => (
              <span key={label} className="label inline-flex items-center gap-2 text-[13px]">
                <span className="size-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                {label}
              </span>
            ))}
          </div>

          {selected && selectedScore && (
            <HouseholdDrawer
              household={selected}
              score={selectedScore}
              suggestion={world.suggestions.get(selected.id)}
              busy={world.busy}
              onActed={money.refresh}
              money={money}
              at={minute}
              operator={operator}
              onClose={() => setSelectedId(null)}
            />
          )}
        </section>

        <SidePanel
          tab={tab}
          onTab={setTab}
          moneyView={
            <MoneyPanel
              money={money}
              forecasts={forecasts}
              simAt={simAt}
              situation={situation}
              horizonHours={FORECAST_HOURS}
              operator={operator}
              onSelect={setSelectedId}
            />
          }
          counts={world.counts}
          held={money.stipends
            .filter((s) => s.decision === "held")
            .map((s) => ({
              householdId: s.householdId,
              label: s.label,
              amountCents: s.amountCents,
              reason: s.checks.find((c) => c.result === "flag")?.detail,
            }))}
          fleetSize={FLEET.length}
          busyCount={world.busy.size}
          suggestions={world.suggestions}
          nearestFireMin={situation.nearestFireMin}
          ranked={world.ranked}
          byId={world.byId}
          assignments={world.assignments}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <footer className="border-t border-line bg-surface/60">
        <Timeline
          start={REPLAY_START}
          end={REPLAY_END}
          t={clock.t}
          playing={clock.playing}
          speed={clock.speed}
          onToggle={clock.toggle}
          onSeek={clock.seek}
          onSpeed={clock.setSpeed}
          hint={!clock.playing && clock.t <= REPLAY_START}
          ticks={FIRE.passes.map((p) => p.at)}
          markers={[
            { at: FIRE.ignition, label: "Ignition", color: "var(--color-ember)" },
            { at: FIRST_ALERT, label: "EvacuAid alert", color: "var(--color-out)", above: true },
            { at: REAL_WEST_ALTADENA_ORDER, label: "Real order", color: "var(--color-help)" },
          ]}
        />
      </footer>
    </>
  );
}
