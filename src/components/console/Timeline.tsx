"use client";

import { useRef } from "react";
import { clockLabel } from "@/lib/replay/eaton";
import { SPEEDS, type Speed } from "./useReplayClock";

export type TimelineMarker = { at: number; label: string; color: string; above?: boolean };

type Props = {
  start: number;
  end: number;
  t: number;
  playing: boolean;
  speed: Speed;
  markers: TimelineMarker[];
  ticks: number[]; // satellite passes
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSpeed: (s: Speed) => void;
  /** Point at the play button until the replay has been started once. */
  hint?: boolean;
};

const HOUR = 3_600_000;

// Keep labels near the edges inside the track.
const align = (pct: number) => (pct < 8 ? "translate-x-0" : pct > 92 ? "-translate-x-full" : "-translate-x-1/2");

export function Timeline({ start, end, t, playing, speed, markers, ticks, onToggle, onSeek, onSpeed, hint }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const pct = (v: number) => ((v - start) / (end - start)) * 100;

  const seekFromPointer = (clientX: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r) return;
    onSeek(start + ((clientX - r.left) / r.width) * (end - start));
  };

  const hours: number[] = [];
  for (let h = start; h <= end; h += 2 * HOUR) hours.push(h);

  return (
    <div className="flex h-full items-center gap-6 px-7">
      <div className="relative shrink-0">
      {hint && (
        <>
          <span className="pulse-ring pointer-events-none absolute -inset-1.5 rounded-full border-2 border-out" aria-hidden />
          <div className="play-hint pointer-events-none absolute bottom-[calc(100%+18px)] left-0 z-30 w-max rounded-2xl border border-out/40 bg-ink/90 px-4 py-3 shadow-[0_0_40px_-10px_var(--color-out)] backdrop-blur">
            <div className="text-[17px] font-medium">Press play to start the night</div>
            <div className="mt-0.5 text-[14.5px] text-muted">The Eaton fire, from 6 PM, as it happened</div>
            <span className="absolute -bottom-[7px] left-[18px] size-3 rotate-45 border-b border-r border-out/40 bg-ink" aria-hidden />
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Play"}
        className={`grid size-11 shrink-0 place-items-center rounded-full border text-fg transition hover:bg-white/[0.08] active:scale-95 ${
          hint ? "border-out bg-out/15 shadow-[0_0_24px_-4px_var(--color-out)]" : "border-line-strong"
        }`}
      >
        {playing ? (
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden>
            <rect width="4" height="14" rx="1" />
            <rect x="8" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="14" viewBox="0 0 10 12" fill="currentColor" aria-hidden>
            <path d="M0 0 L10 6 L0 12 Z" />
          </svg>
        )}
      </button>
      </div>

      <div
        ref={track}
        className="relative h-full flex-1 cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seekFromPointer(e.clientX);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
        <div
          className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-ember/40 to-ember"
          style={{ width: `${pct(t)}%` }}
        />

        {hours.map((h) => (
          <div key={h} className="absolute top-1/2" style={{ left: `${pct(h)}%` }}>
            <div className="h-2 w-px -translate-y-1/2 bg-white/20" />
            <div className={`label absolute top-4 whitespace-nowrap text-[13px] text-faint ${align(pct(h))}`}>
              {clockLabel(h).replace(":00", "")}
            </div>
          </div>
        ))}

        {ticks.map((at) => (
          <div
            key={at}
            title={`Satellite pass ${clockLabel(at)}`}
            className="absolute top-1/2 h-3 w-px -translate-y-[130%] bg-white/45"
            style={{ left: `${pct(at)}%` }}
          />
        ))}

        {markers.map((m) => (
          <div key={m.label} className="absolute top-1/2" style={{ left: `${pct(m.at)}%` }}>
            <div
              className="-translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: 9, height: 9, background: m.color, boxShadow: `0 0 12px ${m.color}` }}
            />
            <div
              className={`label absolute whitespace-nowrap text-[13px] ${m.above ? "bottom-8" : "bottom-4"} ${align(pct(m.at))}`}
              style={{ color: m.color }}
            >
              {m.label}
            </div>
          </div>
        ))}

        <div
          className="pointer-events-none absolute top-1/2 h-7 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[0_0_16px_rgba(255,255,255,0.7)]"
          style={{ left: `${pct(t)}%` }}
        />
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="flex overflow-hidden rounded-full border border-line-strong">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSpeed(s)}
              className={`px-3 py-1.5 font-mono text-[14px] transition ${
                s === speed ? "bg-white/10 text-fg" : "text-faint hover:text-fg"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="w-[96px] text-right font-mono text-[17px] tabular-nums text-fg">{clockLabel(t)}</div>
      </div>
    </div>
  );
}
