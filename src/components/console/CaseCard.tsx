"use client";

import { useState } from "react";
import { AID_KINDS, type AidKind } from "@/lib/budget";
import { driveMin } from "@/lib/ops/trips";
import type { Suggestion } from "@/lib/ops/recommend";
import { FLEET } from "@/lib/replay/fleet";
import type { ConsoleHousehold } from "./ConsoleApp";
import { liveAction } from "./useLive";
import { dollars } from "./useMoney";

const QUESTIONS = {
  en: [
    "Are you safe right now?",
    "How many people are with you, and any pets?",
    "Any oxygen, wheelchair or medical equipment we should know about?",
    "Can you get to the street to meet the driver?",
    "Does your car have enough gas to get out now?",
  ],
  es: [
    "¿Está a salvo ahora mismo?",
    "¿Cuántas personas están con usted, y hay mascotas?",
    "¿Hay oxígeno, silla de ruedas o equipo médico que debamos saber?",
    "¿Puede llegar a la calle para encontrar al conductor?",
    "¿Su carro tiene suficiente gasolina para salir ahora?",
  ],
};

const KIND = {
  ride: { label: "RIDE", tone: "bg-help/15 text-help", what: "Can't leave without a vehicle. Money won't help." },
  check: { label: "DOOR KNOCK", tone: "bg-silent/15 text-silent", what: "Silent after two texts. Someone needs to check the home." },
  aid: { label: "AID", tone: "bg-leaving/15 text-leaving", what: "Can drive out; cost is the barrier." },
};

type Props = {
  h: ConsoleHousehold;
  suggestion: Suggestion | undefined;
  busy: Map<string, string>;
  at: number;
  operator: boolean;
  onDone: () => void;
};

/** The operator's decision for one case: EvacuAid's summary and suggestion, then a person decides. */
export function CaseCard({ h, suggestion, busy, at, operator, onDone }: Props) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pickVehicle, setPickVehicle] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const c = h.case;
  if (!c) return null;
  const k = KIND[c.kind];
  const mine = h.sector === "you";
  const lang = h.language === "es" ? "es" : "en";
  const open = c.status === "review" || c.status === "gathering";

  const run = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusyAction(key);
    setError(null);
    setDone(null);
    try {
      await fn();
      if (ok) setDone(ok);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyAction(null);
    }
  };
  const who = h.live ? "Text sent to their phone" : "Shown in the replay";
  const dispatch = (vehicleId: string) =>
    run(
      `v-${vehicleId}`,
      () => liveAction("/api/cases/dispatch", { householdId: h.id, vehicleId, at }),
      `${FLEET.find((v) => v.id === vehicleId)?.name ?? "Vehicle"} dispatched · trip billed to county operations · ${who}`,
    );
  const approve = (kind: AidKind) =>
    run(
      `a-${kind}`,
      async () => {
        const r = (await liveAction("/api/bank/stipend", { householdId: h.id, kind, at, noTransport: h.needs.noTransport })) as { decision?: string };
        if (r.decision && r.decision !== "approved") throw new Error(`Bank checks: ${r.decision}. ${who}.`);
      },
      `${dollars(AID_KINDS[kind].cents)} approved on Nessie · releasing from the Solana pool · ${who}`,
    );
  const ask = (text: string) =>
    run("msg", () => liveAction("/api/cases/message", { householdId: h.id, text, at }).then(() => setDraft("")), `Message sent · ${who}`);

  const facts = [
    c.people && `${c.people} ${c.people === 1 ? "person" : "people"}`,
    (c.wheelchair || h.needs.mobility) && "wheelchair",
    (c.medical || h.needs.medical) && "medical equipment",
    h.needs.pets && "pets",
    h.needs.children && "children",
    h.leftBehind && `left behind: ${h.leftBehind}`,
    h.language === "es" && "Spanish",
  ].filter(Boolean) as string[];

  const available = FLEET.filter((v) => !busy.has(v.id) && (!(c.wheelchair || h.needs.mobility) || v.wheelchair)).map((v) => ({
    ...v,
    eta: driveMin(v.location, h.location),
  }));

  return (
    <div className={`mt-1 rounded-2xl border p-4 ${open && mine ? "border-help/40 bg-help/[0.05]" : "border-line bg-white/[0.02]"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[12.5px] font-semibold tracking-wider ${k.tone}`}>{k.label}</span>
        <span className="text-[13.5px] text-muted">
          {c.status === "review" && (mine ? "Waiting for you" : `Waiting for ${c.handledBy ?? "another operator"}`)}
          {c.status === "gathering" && "EvacuAid is asking questions"}
          {c.status === "dispatched" && `${c.vehicleName} on the way · ${c.etaMin} min`}
          {c.status === "onboard" && `On board ${c.vehicleName}`}
          {c.status === "done" && "Done: safe at the shelter"}
          {c.status === "approved" && "Aid approved"}
          {c.status === "held" && "Held by a bank check"}
          {c.status === "declined" && "Declined"}
        </span>
      </div>
      <p className="mt-2 text-[14.5px] text-muted">{k.what}</p>
      {h.trackToken && (c.status === "dispatched" || c.status === "onboard" || c.status === "done") && (
        <a href={`/t/${h.trackToken}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[13.5px] text-out hover:underline">
          📍 The resident&apos;s live tracking page ↗
        </a>
      )}
      {facts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {facts.map((f) => (
            <span key={f} className="rounded-full border border-line px-2 py-0.5 text-[13px] text-fg">
              {f}
            </span>
          ))}
        </div>
      )}

      {!mine && c.handledBy && <p className="mt-3 text-[14px] text-faint">Handled by {c.handledBy} in another sector.</p>}

      {/* Your decision */}
      {mine && open && c.kind !== "aid" && (
        <div className="mt-3">
          <div className="text-[13.5px] text-faint">EvacuAid suggests</div>
          {suggestion ? (
            <button
              type="button"
              disabled={!operator || busyAction !== null}
              onClick={() => dispatch(suggestion.vehicleId)}
              className="mt-1 flex w-full items-center justify-between rounded-xl bg-fg px-3.5 py-2.5 text-left text-ink transition hover:bg-white disabled:opacity-50"
            >
              <span className="text-[16px] font-medium">
                {busyAction === `v-${suggestion.vehicleId}` ? "Dispatching…" : `Dispatch ${suggestion.name}`}
              </span>
              <span className="font-mono text-[14px]">
                {suggestion.etaMin} min{suggestion.wheelchair ? " · ♿" : ""}
              </span>
            </button>
          ) : (
            <p className="mt-1 rounded-xl border border-silent/40 px-3 py-2 text-[14.5px] text-silent">
              No suitable vehicle free in your sector. Ask a neighbor sector, or send aid if they can drive.
            </p>
          )}
          {operator && available.length > 1 && (
            <button type="button" onClick={() => setPickVehicle((p) => !p)} className="mt-1.5 text-[13.5px] text-muted hover:text-fg">
              {pickVehicle ? "Hide other vehicles" : "Choose another vehicle"}
            </button>
          )}
          {pickVehicle && (
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {available.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => dispatch(v.id)}
                  className="rounded-lg border border-line-strong px-2.5 py-1.5 text-left text-[13.5px] transition hover:bg-white/[0.06] disabled:opacity-50"
                >
                  {v.name}
                  <span className="block font-mono text-[12.5px] text-faint">
                    {v.eta} min{v.wheelchair ? " · ♿" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-[12.5px] text-faint">The trip is billed to County Emergency Operations, not relief aid.</p>
        </div>
      )}

      {mine && open && c.kind === "aid" && (
        <div className="mt-3">
          <div className="text-[13.5px] text-faint">EvacuAid suggests (sized from their answers)</div>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {(Object.keys(AID_KINDS) as AidKind[]).map((key) => {
              const a = AID_KINDS[key];
              const suggested = (c.aid ?? "gas") === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!operator || busyAction !== null}
                  onClick={() => approve(key)}
                  className={`rounded-xl border px-2 py-2 text-left transition disabled:opacity-50 ${
                    suggested ? "border-fg bg-fg text-ink hover:bg-white" : "border-line-strong hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="font-mono text-[16px] font-medium">{busyAction === `a-${key}` ? "…" : dollars(a.cents)}</div>
                  <div className={`text-[12px] leading-tight ${suggested ? "text-ink/70" : "text-muted"}`}>{a.label}</div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12.5px] text-faint">Approving runs five bank checks first. Paid from the donor pool on Solana, onto a card that only buys evacuation.</p>
        </div>
      )}

      {/* Talk to them */}
      {mine && operator && c.status !== "done" && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-[13.5px] text-faint">Ask before you decide</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUESTIONS[lang].map((q) => (
              <button
                key={q}
                type="button"
                disabled={busyAction !== null}
                onClick={() => ask(q)}
                className="rounded-full border border-line-strong px-2.5 py-1 text-[13px] text-muted transition hover:text-fg disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) ask(draft.trim());
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={h.live ? "Message them directly…" : "Message (shown in the replay)…"}
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-transparent px-3 py-2 text-[14.5px] outline-none placeholder:text-faint focus:border-white/30"
            />
            <button type="submit" disabled={!draft.trim() || busyAction !== null} className="rounded-lg bg-fg px-3 text-[14.5px] font-medium text-ink disabled:opacity-40">
              Send
            </button>
          </form>
        </div>
      )}
      {done && <p className="rise mt-3 rounded-xl border border-out/40 bg-out/[0.08] px-3 py-2 text-[14.5px] text-out">✓ {done}</p>}
      {error && <p className="mt-2 rounded-xl border border-help/40 bg-help/[0.08] px-3 py-2 text-[14px] text-help">{error}</p>}
    </div>
  );
}
