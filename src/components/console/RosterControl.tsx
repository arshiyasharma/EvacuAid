"use client";

import { useState } from "react";
import { liveAction, type LiveState } from "./useLive";

/** Header control: real phone numbers that receive the alert, and the one-click send. */
export function RosterControl({ live }: { live: LiveState }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const count = live.households.length;
  const on = live.households.filter((h) => h.alertsOn !== false).length;

  return (
    <div className="relative flex items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-line-strong px-4 py-1.5 text-[15.5px] text-fg transition hover:bg-white/[0.05]"
      >
        Real phones <span className="ml-1 font-mono text-muted">{on === count ? count : `${on}/${count}`}</span>
      </button>
      <button
        type="button"
        disabled={busy || on === 0}
        onClick={() => run(() => liveAction("/api/alert"))}
        className="rounded-full bg-help px-4 py-1.5 text-[15.5px] font-medium text-white shadow-[0_0_30px_-6px_var(--color-help)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {live.alertSentAt ? `Resend alert · ${on}` : `Send alert · ${on}`}
      </button>

      {open && (
        <div className="panel rise absolute right-0 top-11 z-20 max-h-[70vh] w-[420px] overflow-y-auto rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="label text-[13px] text-fg">Real phones</span>
            <span className={`label text-[12px] ${live.photon?.on ? "text-out" : "text-silent"}`}>
              {live.photon?.on ? "iMessage on" : "Simulated"}
            </span>
          </div>
          {live.photon?.on && live.photon.number && (
            <div className="mt-3 rounded-xl border border-out/25 bg-out/[0.06] px-3.5 py-3">
              <div className="text-[14.5px] text-muted">Residents sign up by texting EVAC to</div>
              <div className="mt-0.5 font-mono text-[20px] tracking-tight text-fg">
                {live.photon.number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}
              </div>
              {live.photon.error && <div className="mt-1 text-[13.5px] text-help">{live.photon.error}</div>}
            </div>
          )}

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await liveAction("/api/roster", { name, phone });
                setName("");
                setPhone("");
              });
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-[110px] rounded-lg border border-line-strong bg-transparent px-3 py-2 text-[16px] outline-none placeholder:text-faint focus:border-white/30"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              inputMode="tel"
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-transparent px-3 py-2 font-mono text-[16px] outline-none placeholder:text-faint focus:border-white/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-fg px-3 text-[16px] font-medium text-ink disabled:opacity-40"
            >
              Add
            </button>
          </form>
          {error && <p className="mt-2 text-[14.5px] text-help">{error}</p>}

          <ul className="mt-3 space-y-1">
            {live.households.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.04]">
                <span className="min-w-0">
                  <span className="block truncate text-[16px]">{h.name || "Resident"}</span>
                  <span className="block font-mono text-[13.5px] text-muted">
                    {h.phone}
                    {h.source === "signup" ? " · signed up" : h.source === "text" ? " · texted in" : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={h.alertsOn !== false}
                    aria-label={`Send alerts to ${h.name || h.phone}`}
                    title={h.alertsOn !== false ? "Gets the alert" : "Skipped when you send"}
                    onClick={() => run(() => liveAction("/api/roster", { phone: h.phone, alertsOn: h.alertsOn === false }, "PATCH"))}
                    className={`relative h-6 w-11 rounded-full transition ${h.alertsOn !== false ? "bg-out" : "bg-white/15"}`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${h.alertsOn !== false ? "left-[22px]" : "left-0.5"}`}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${h.name}`}
                    onClick={() => run(() => liveAction(`/api/roster?phone=${encodeURIComponent(h.phone)}`, undefined, "DELETE"))}
                    className="text-faint transition hover:text-help"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
            {count === 0 && (
              <li className="px-2 py-1.5 text-[15.5px] text-faint">Sign-ups from the landing page and anyone who texts EVAC show up here.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
