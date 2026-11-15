import { describe, expect, it } from "vitest";
import { aidDecisionText, ALERT, newConv, step, type Conv } from "@/lib/agent/conversation";
import type { Needs } from "@/lib/types";

const needs = (n: Partial<Needs> = {}): Needs => ({ mobility: false, medical: false, children: false, pets: false, noTransport: false, money: false, people: 1, ...n });
const at = (stage: Conv["stage"], extra: Partial<Conv> = {}): Conv => ({ ...newConv(), stage, ...extra });

describe("the alert", () => {
  it("is loud, numbered, and says how to stop", () => {
    expect(ALERT.en).toMatch(/EVACUATION WARNING/);
    expect(ALERT.en).toMatch(/1 = I'M OUT/);
    expect(ALERT.en).toMatch(/STOP/);
  });
});

describe("conversation flows", () => {
  it("1 → out, then asks if anyone is left", () => {
    const s = step(newConv(), "1", "en", needs())!;
    expect(s.status).toBe("out");
    expect(s.stage).toBe("out_anyone_left");
    expect(s.reply).toMatch(/anyone still at your home/);
  });

  it("out + Y flags someone left behind; N closes", () => {
    const y = step(at("out_anyone_left"), "yes", "en", needs())!;
    expect(y.status).toBe("needs_help");
    expect(y.leftBehind).toBeTruthy();
    expect(step(at("out_anyone_left"), "N", "en", needs())!.stage).toBe("out_done");
  });

  it("2 → plan; C sizes aid instead of promising $770", () => {
    const c = step(at("leaving_plan"), "C", "en", needs())!;
    expect(c.stage).toBe("aid_car");
    expect(c.reply).not.toMatch(/\$770/);
    expect(c.case?.kind).toBe("aid");
  });

  it("aid: has a car + going to family → $150 gas for an operator to review", () => {
    expect(step(at("aid_car"), "y", "en", needs())!.stage).toBe("aid_dest");
    const d = step(at("aid_dest"), "B", "en", needs())!;
    expect(d.stage).toBe("aid_review");
    expect(d.case).toMatchObject({ kind: "aid", status: "review", aid: "gas" });
    expect(d.reply).toMatch(/operator is reviewing \$150/);
  });

  it("aid: needs a room → suggests gas + a night", () => {
    expect(step(at("aid_dest"), "c", "en", needs())!.case?.aid).toBe("night");
  });

  it("aid: no working car → it's a ride, not money", () => {
    const n = step(at("aid_car"), "no", "en", needs())!;
    expect(n.stage).toBe("help_people");
    expect(n.case?.kind).toBe("ride");
  });

  it("3 → what's wrong; A,B → head count → ride case for the operator", () => {
    expect(step(newConv(), "3", "en", needs())!.stage).toBe("help_what");
    const ab = step(at("help_what"), "a and b", "en", needs())!;
    expect(ab.needs).toMatchObject({ mobility: true, noTransport: true });
    const n = step(at("help_people"), "3 + dog", "en", needs({ mobility: true }))!;
    expect(n.stage).toBe("ride_review");
    expect(n.case).toMatchObject({ kind: "ride", status: "review", people: 3, wheelchair: true });
    expect(n.reply).toMatch(/operator is confirming/);
  });

  it("D alone sizes aid; never auto-pays", () => {
    const d = step(at("help_what"), "d", "en", needs())!;
    expect(d.stage).toBe("aid_car");
  });

  it("a number while asking head count is people, not status", () => {
    expect(step(at("help_people"), "2", "en", needs())!.needs?.people).toBe(2);
    expect(step(at("help_people"), "just me", "en", needs())!.needs?.people).toBe(1);
  });

  it("free text goes to the agent", () => {
    expect(step(newConv(), "my mom can't walk", "en", needs())).toBeNull();
    expect(step(at("help_what"), "bad", "en", needs())).toBeNull();
  });

  it("approval text says what the card can't buy and that unused money returns", () => {
    const t = aidDecisionText("en", "approved", "gas", 150_00);
    expect(t).toMatch(/APPROVED: \$150/);
    expect(t).toMatch(/ONLY works/);
    expect(t).toMatch(/goes back to the relief fund/);
  });

  it("speaks Spanish", () => {
    expect(step(newConv(), "3", "es", needs())!.reply).toMatch(/problema principal/);
    expect(step(at("out_anyone_left"), "sí", "es", needs())!.stage).toBe("out_who_left");
  });
});
