// Gemini triage: turns any reply, in any language, into a status, needs, and a
// short reply in the resident's language. Falls back to keyword rules on error.

import { GoogleGenAI } from "@google/genai";
import { MANAGEMENT_PROMPT } from "./agent/prompt";
import { STAGES, type Stage } from "./agent/conversation";
import { triage as ruleTriage } from "./triage";
import type { Needs, Status } from "./types";

export type AiTriage = {
  status: Status;
  needs: Partial<Needs>;
  language: string;
  summary: string; // one line for the operator
  reply: string; // what we text back
  engine: "gemini" | "rules";
  ms: number;
};

// Fast model for live texting; override with GEMINI_TRIAGE_MODEL / GEMINI_TRIAGE_THINKING.
// Flash-Lite measured ~2 s per message; Flash and Hydrogen ranged 2-110 s.
const MODEL = process.env.GEMINI_TRIAGE_MODEL || "gemini-3.5-flash-lite";
const THINKING = process.env.GEMINI_TRIAGE_THINKING || "minimal";

const SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["out", "leaving", "needs_help"] },
    mobility: { type: "boolean" },
    medical: { type: "boolean" },
    children: { type: "boolean" },
    pets: { type: "boolean" },
    noTransport: { type: "boolean" },
    money: { type: "boolean" },
    people: { type: "integer" },
    language: { type: "string", description: "ISO 639-1 code of the resident's message" },
    summary: { type: "string", description: "Under 12 words, for the emergency operator" },
    reply: { type: "string", description: "Under 280 characters, in the resident's language" },
  },
  required: ["status", "language", "summary", "reply"],
};

const INSTRUCTIONS = `You triage replies to an evacuation alert sent by EvacuAid during a wildfire.
The alert said: "Reply 1 I'm out, 2 leaving now, 3 I need help."
"1" means out, "2" means leaving, "3" means needs_help. Anyone who mentions being stuck, unable to move, no car, no money, medical equipment, or asks for help is needs_help.
Only set a need to true if the message states it. "can't walk" or "wheelchair" is mobility, not medical. medical is only for oxygen, dialysis, medication, pregnancy, or illness. people = how many people need a ride (default 1).
Write the reply in the resident's language. Be calm and brief. Never promise a time.
If needs_help: say help is being arranged, to stay where they are and keep the phone on.
If leaving: say thank you, drive safe, and reply 3 if anything changes.
If out: say glad you are safe, and reply 3 if anything changes.`;

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({}) : null;

export async function triageWithGemini(text: string): Promise<AiTriage> {
  const t0 = Date.now();
  if (ai) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = await ai.interactions.create({
        model: MODEL,
        input: `${INSTRUCTIONS}\n\nResident's reply: """${text.slice(0, 500)}"""`,
        response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
        generation_config: { thinking_level: THINKING },
      });
      const j = JSON.parse(r.output_text);
      const needs: Partial<Needs> = {};
      for (const k of ["mobility", "medical", "children", "pets", "noTransport", "money"] as const) {
        if (j[k]) needs[k] = true;
      }
      if (Number.isInteger(j.people) && j.people > 0) needs.people = j.people;
      return {
        status: j.status,
        needs,
        language: j.language || "en",
        summary: j.summary,
        reply: j.reply,
        engine: "gemini",
        ms: Date.now() - t0,
      };
    } catch (e) {
      console.warn("[gemini] falling back to rules:", (e as Error).message);
    }
  }

  return ruleFallback(text, t0);
}

function ruleFallback(text: string, t0: number): AiTriage {
  const r = ruleTriage(text);
  const reply =
    r.status === "needs_help"
      ? "Help is being arranged. Stay where you are and keep your phone on."
      : r.status === "leaving"
        ? "Thank you. Drive safe. Reply 3 if anything changes."
        : "Glad you're safe. Reply 3 if anything changes.";
  return {
    status: r.status,
    needs: r.needs,
    language: "en",
    summary: r.matched.join(", ") || r.status,
    reply,
    engine: "rules",
    ms: Date.now() - t0,
  };
}

// ---- the conversational agent ---------------------------------------------

export type AgentTurn = AiTriage & {
  stage: Stage;
  leftBehind: string;
  emergency: boolean;
  offerStipend: boolean;
};

const AGENT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["out", "leaving", "needs_help"] },
    stage: { type: "string", enum: STAGES },
    mobility: { type: "boolean" },
    medical: { type: "boolean" },
    children: { type: "boolean" },
    pets: { type: "boolean" },
    noTransport: { type: "boolean" },
    money: { type: "boolean" },
    people: { type: "integer" },
    leftBehind: { type: "string" },
    emergency: { type: "boolean" },
    offerStipend: { type: "boolean" },
    language: { type: "string" },
    summary: { type: "string" },
    reply: { type: "string" },
  },
  required: ["status", "stage", "language", "summary", "reply", "leftBehind", "emergency", "offerStipend"],
};

export type AgentContext = {
  stage: Stage;
  status: string;
  needs: Needs;
  language: string;
  driverAssigned: string | null;
  stipend: string | null;
  history: { from: "resident" | "evacuaid"; text: string }[];
};

/** One turn of the resident conversation, with full context. Falls back to rules. */
export async function converseWithGemini(text: string, ctx: AgentContext): Promise<AgentTurn> {
  const t0 = Date.now();
  if (ai) {
    try {
      const known = Object.entries(ctx.needs)
        .filter(([k, v]) => (k === "people" ? false : v))
        .map(([k]) => k);
      const input = `${MANAGEMENT_PROMPT}

# Context for this turn
- Current stage: ${ctx.stage}
- Current household status: ${ctx.status}
- Needs known so far: ${known.join(", ") || "none"}; people needing a ride: ${ctx.needs.people}
- Last language used: ${ctx.language}
- Driver assigned: ${ctx.driverAssigned ?? "NOT YET. Do not say anyone is on the way or coming; say help is being arranged."}
- Stipend: ${ctx.stipend ?? "not offered"}

# Conversation so far (oldest first)
${ctx.history
  .slice(-12)
  .map((m) => `${m.from === "resident" ? "Resident" : "EvacuAid"}: ${m.text}`)
  .join("\n")}

# Resident's new message
"""${text.slice(0, 500)}"""`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r: any = await ai.interactions.create({
        model: MODEL,
        input,
        response_format: { type: "text", mime_type: "application/json", schema: AGENT_SCHEMA },
        generation_config: { thinking_level: THINKING },
      });
      const j = JSON.parse(r.output_text);
      const needs: Partial<Needs> = {};
      for (const k of ["mobility", "medical", "children", "pets", "noTransport", "money"] as const) {
        if (j[k]) needs[k] = true;
      }
      if (Number.isInteger(j.people) && j.people > 0) needs.people = j.people;
      // Never promise a ride that doesn't exist yet.
      let reply: string = j.reply;
      if (!ctx.driverAssigned && /\b(on (our|the|its|their) way|coming (to|for) (you|get)|heading (to|over)|en camino|vamos para)\b/i.test(reply)) {
        reply =
          ctx.language === "es"
            ? "Estamos organizando ayuda. Quédese junto a la puerta con el teléfono encendido. Le avisaremos cuando un conductor esté asignado."
            : "We're arranging help now. Stay by your front door with your phone on. We'll text you as soon as a driver is assigned.";
      }
      return {
        status: j.status,
        stage: STAGES.includes(j.stage) ? j.stage : ctx.stage,
        needs,
        leftBehind: j.leftBehind ?? "",
        emergency: Boolean(j.emergency),
        offerStipend: Boolean(j.offerStipend),
        language: j.language || ctx.language,
        summary: j.summary,
        reply,
        engine: "gemini",
        ms: Date.now() - t0,
      };
    } catch (e) {
      console.warn("[gemini agent] falling back to rules:", (e as Error).message);
    }
  }

  const base = ruleFallback(text, t0);
  const stage: Stage =
    base.status === "needs_help" ? "help_confirmed" : base.status === "leaving" ? "leaving_plan" : "out_anyone_left";
  return { ...base, stage, leftBehind: "", emergency: false, offerStipend: false, ms: Date.now() - t0 };
}
