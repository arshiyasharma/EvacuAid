"use client";

import { useEffect, useState } from "react";
import type { LiveHousehold } from "@/lib/live/store";
import type { Bill, Dispatch, OpsMessage } from "@/lib/ops/trips";

export type LiveState = {
  version: number;
  alertSentAt: number | null;
  resetAt?: number | null;
  households: LiveHousehold[];
  operator?: boolean;
  ops?: { dispatches: Dispatch[]; messages: OpsMessage[]; bills: Bill[]; version?: number };
  photon?: { on: boolean; number: string | null; polling: boolean; connected: number; error: string | null };
};

const EMPTY: LiveState = { version: -1, alertSentAt: null, households: [] };

/** Polls the live store. 1.5 s keeps replies feeling instant without a socket. */
export function useLive(intervalMs = 1500) {
  const [state, setState] = useState<LiveState>(EMPTY);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (res.ok) {
          const next = (await res.json()) as LiveState;
          setState((prev) => (prev.version === next.version &&
            prev.ops?.version === next.ops?.version &&
            prev.photon?.error === next.photon?.error &&
            prev.operator === next.operator
              ? prev
              : next));
        }
      } catch {
        // offline for a moment; try again
      }
      if (!stop) timer = setTimeout(load, intervalMs);
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [intervalMs]);

  return state;
}

export async function liveAction(path: string, body?: unknown, method = "POST") {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j;
}
