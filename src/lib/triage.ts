// Turns a resident's reply into a status and structured needs.
// v1 is deterministic keyword rules so it runs offline and is testable.
// The Gemini path will call the same interface and fall back to this.

import type { Needs, Status } from "./types";

export type TriageResult = {
  status: Status;
  needs: Partial<Needs>;
  matched: string[]; // which rules fired, shown on the dashboard
};

const RULES: { key: keyof Needs; label: string; patterns: RegExp[] }[] = [
  {
    key: "mobility",
    label: "mobility",
    patterns: [/can'?t walk/, /cannot walk/, /wheel ?chair/, /bed ?(ridden|bound)/, /walker/, /can'?t move/, /disabled/],
  },
  {
    key: "medical",
    label: "medical",
    patterns: [/oxygen/, /dialysis/, /insulin/, /ventilator/, /medication/, /sick/, /pregnan/],
  },
  {
    key: "children",
    label: "children",
    patterns: [/\bkids?\b/, /child/, /baby/, /infant/, /toddler/],
  },
  {
    key: "pets",
    label: "pets",
    patterns: [/\bdogs?\b/, /\bcats?\b/, /\bpets?\b/, /horse/],
  },
  {
    key: "noTransport",
    label: "no transport",
    patterns: [/no car/, /don'?t have a car/, /car'?s? (is )?(in the shop|broken|dead)/, /no ride/, /can'?t drive/, /no way to leave/],
  },
  {
    key: "money",
    label: "money",
    patterns: [/can'?t afford/, /no money/, /\bbroke\b/, /hotel/, /\bgas money\b/, /pay for/],
  },
];

export function triage(text: string): TriageResult {
  const t = text.toLowerCase().trim();
  const needs: Partial<Needs> = {};
  const matched: string[] = [];

  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(t))) {
      (needs as Record<string, boolean>)[rule.key] = true;
      matched.push(rule.label);
    }
  }

  const people = t.match(/\b(\d+)\s+(people|of us|persons)\b/);
  if (people) needs.people = Number(people[1]);

  let status: Status;
  if (/^\s*1\b/.test(t) || /\b(i'?m|we'?re|already) out\b/.test(t) || /\bsafe\b/.test(t)) {
    status = "out";
  } else if (/^\s*2\b/.test(t) || /leaving now|on (my|our) way|heading out|driving out/.test(t)) {
    status = "leaving";
  } else if (/^\s*3\b/.test(t) || /help|stuck|trapped|can'?t|need/.test(t) || matched.length > 0) {
    status = "needs_help";
  } else {
    status = "needs_help"; // unclear replies get a human look rather than silence
    matched.push("unclear reply");
  }

  // Someone who is out but mentions needs is still out; keep the needs for shelter matching.
  return { status, needs, matched };
}
