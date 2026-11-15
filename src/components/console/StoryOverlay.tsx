"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clockLabel, FIRE, RATE_OF_SPREAD_KMH, REAL_WEST_ALTADENA_ORDER } from "@/lib/replay/eaton";
import { FIRST_ALERT, SIM_HOUSEHOLDS } from "@/lib/replay/households";

type Beat = { at: number; eyebrow: string; title: string; sub: string; color: string };

const MIN = 60_000;
const SHOW_MS = 6500;

function hm(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / MIN);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** The night as a story: big, unmissable moments as the replay crosses them. */
function beats(): Beat[] {
  // Far enough before the alert that both moments get their own screen time at 240×.
  const predictAt = Math.min(FIRST_ALERT - 15 * MIN, FIRE.ignition + 12 * MIN);
  const inReach = SIM_HOUSEHOLDS.filter((h) => h.fireEta - predictAt <= 4 * 60 * MIN).length;
  const firstWave = SIM_HOUSEHOLDS.filter((h) => h.alertAt <= FIRST_ALERT + 30 * MIN).length;
  const firstFire = Math.min(...FIRE.points.map((p) => p.seen));
  return [
    {
      at: FIRE.ignition,
      eyebrow: `${clockLabel(FIRE.ignition)} · Ignition`,
      title: "Fire starts in Eaton Canyon",
      sub: "Extreme Santa Ana winds. Altadena is downhill and downwind.",
      color: "var(--color-ember)",
    },
    {
      at: predictAt,
      eyebrow: `${clockLabel(predictAt)} · EvacuAid predicts`,
      title: `${inReach} homes in the fire's path within 4 hours`,
      sub: `Spread measured from NASA satellite passes: up to ${RATE_OF_SPREAD_KMH} km/h. Alerts go out two hours ahead of the front.`,
      color: "var(--color-silent)",
    },
    {
      at: FIRST_ALERT,
      eyebrow: `${clockLabel(FIRST_ALERT)} · EvacuAid alert`,
      title: `Texting ${firstWave} households now`,
      sub: "Reply 1 I'm out · 2 leaving now · 3 I need help. Every reply ranks who to reach first.",
      color: "var(--color-out)",
    },
    {
      at: firstFire,
      eyebrow: `${clockLabel(firstFire)} · Satellite`,
      title: "NASA sees the first fire pixels",
      sub: "Each satellite pass sharpens the forecast and moves the alert line.",
      color: "var(--color-ember)",
    },
    {
      at: REAL_WEST_ALTADENA_ORDER,
      eyebrow: `${clockLabel(REAL_WEST_ALTADENA_ORDER)} · What really happened`,
      title: "West Altadena's real order goes out",
      sub: `EvacuAid had alerted these streets ${hm(REAL_WEST_ALTADENA_ORDER - FIRST_ALERT)} earlier. 18 of the 19 deaths were here.`,
      color: "var(--color-help)",
    },
  ].sort((a, b) => a.at - b.at);
}

type Props = { minute: number; liveAlertAt: number | null; livePhones: number };

export function StoryOverlay({ minute, liveAlertAt, livePhones }: Props) {
  const list = useMemo(() => beats(), []);
  const [shown, setShown] = useState<{ beat: Beat; key: number } | null>(null);
  const last = useRef(minute);
  const lastLive = useRef(liveAlertAt);

  // Show a beat when the replay plays forward across it (not when scrubbing back).
  useEffect(() => {
    const prev = last.current;
    last.current = minute;
    if (minute <= prev || minute - prev > 90 * MIN) return;
    const crossed = list.filter((b) => b.at > prev && b.at <= minute).pop();
    if (crossed) setShown({ beat: crossed, key: Date.now() });
  }, [minute, list]);

  // The operator pressed Send alert: real phones are being texted.
  useEffect(() => {
    // Only a fresh send: opening the console later must not replay an old alert.
    if (liveAlertAt && liveAlertAt !== lastLive.current && Date.now() - liveAlertAt < 15_000) {
      setShown({
        beat: {
          at: liveAlertAt,
          eyebrow: "Live · Operator",
          title: `Alert sent to ${livePhones} real ${livePhones === 1 ? "phone" : "phones"}`,
          sub: "Replies land on this map in seconds and go straight into the priority queue.",
          color: "var(--color-out)",
        },
        key: Date.now(),
      });
    }
    lastLive.current = liveAlertAt;
  }, [liveAlertAt, livePhones]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [shown]);

  if (!shown) return null;
  const { beat } = shown;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-28 z-20 flex justify-center px-6">
      <div
        key={shown.key}
        className="story-in relative max-w-[640px] overflow-hidden rounded-3xl border bg-ink/80 px-8 py-6 text-center backdrop-blur-xl"
        style={{ borderColor: `color-mix(in srgb, ${beat.color} 45%, transparent)`, boxShadow: `0 0 80px -20px ${beat.color}` }}
      >
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${beat.color}, transparent)` }} />
        <div className="label text-[13px]" style={{ color: beat.color }}>
          {beat.eyebrow}
        </div>
        <div className="mt-2 text-[32px] font-medium leading-tight tracking-[-0.02em]">{beat.title}</div>
        <div className="mt-2 text-[17px] leading-snug text-muted">{beat.sub}</div>
        <div className="story-bar absolute inset-x-0 bottom-0 h-0.5" style={{ background: beat.color, animationDuration: `${SHOW_MS}ms` }} />
      </div>
    </div>
  );
}
