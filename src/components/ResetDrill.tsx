"use client";

import { useState } from "react";

/** Operator only: start the whole drill over (situation, ledger, bank fund, on-chain caps). */
export function ResetDrill({ onDone }: { onDone?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Reset failed");
      if (j.warning) setNote(j.warning);
      setConfirming(false);
      onDone?.();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full border border-line-strong px-3.5 py-1.5 text-[15px] text-muted transition hover:border-help/50 hover:text-help"
      >
        Reset drill
      </button>
    );
  }
  return (
    <div className="relative">
      <div className="panel rise absolute right-0 top-0 z-40 w-[340px] rounded-2xl border-help/40 p-4">
        <div className="text-[17px] font-medium">Start the drill over?</div>
        <p className="mt-1 text-[14.5px] leading-snug text-muted">
          Clears every status, message, payment and purchase, opens a fresh $120,000 relief fund, and resets on-chain caps. People who
          signed up stay on the list.
        </p>
        {note && <p className="mt-2 text-[14px] text-help">{note}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="flex-1 rounded-xl bg-help py-2 text-[15.5px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "Resetting…" : "Reset everything"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded-xl border border-line-strong py-2 text-[15.5px] text-muted"
          >
            Cancel
          </button>
        </div>
      </div>
      <span className="invisible rounded-full border px-3.5 py-1.5 text-[15px]">Reset drill</span>
    </div>
  );
}
