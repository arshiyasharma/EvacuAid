"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const SPEEDS = [60, 240, 900] as const; // replay seconds per real second
export type Speed = (typeof SPEEDS)[number];

/** A replay clock over [start, end] that plays, pauses, scrubs and changes speed. */
export function useReplayClock(start: number, end: number) {
  const [t, setT] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(240);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : now - last.current;
      last.current = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing, speed, end]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p) setT((prev) => (prev >= end ? start : prev));
      return !p;
    });
  }, [start, end]);

  const seek = useCallback((value: number) => setT(Math.min(end, Math.max(start, value))), [start, end]);

  return { t, playing, speed, setSpeed, toggle, seek };
}
