"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const getSecond = () => Math.floor(Date.now() / 1000);
const getServerSecond = () => null;

export function Clock() {
  const second = useSyncExternalStore(subscribe, getSecond, getServerSecond);
  return (
    <span className="font-mono text-[16px] tabular-nums tracking-[0.06em] text-muted">
      {second === null ? "--:--:--" : new Date(second * 1000).toLocaleTimeString("en-US", { hour12: false })}
    </span>
  );
}
