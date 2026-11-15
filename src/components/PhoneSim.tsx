"use client";

import { useEffect, useRef, useState } from "react";
import { liveAction, useLive } from "@/components/console/useLive";
import { normalizePhone } from "@/lib/live/phone";

const DEFAULT_PHONE = "+16265550100";

/** Taps that answer whatever EvacuAid just asked. */
function suggestions(stage: string | undefined): string[] {
  switch (stage) {
    case "out_anyone_left":
      return ["N", "Y", "my dad is still inside"];
    case "out_who_left":
      return ["my dad, he uses a walker", "our dog"];
    case "leaving_plan":
      return ["A", "B", "C"];
    case "money_offer":
      return ["YES", "NO"];
    case "help_what":
      return ["A", "B", "A and B", "D", "my mom can't walk"];
    case "help_people":
      return ["2", "3 + dog", "just me"];
    case "help_confirmed":
      return ["my neighbor is alone next door", "1", "2"];
    case "leaving_done":
      return ["1"];
    default:
      return ["1", "2", "3", "my mom can't walk", "no car, 3 of us"];
  }
}

/** A Messages-style phone that talks to EvacuAid through the same pipeline as SMS. */
export function PhoneSim() {
  const live = useLive(1000);
  // Each browser gets its own fictional 555 number, so visitors don't share a household.
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_PHONE;
    try {
      let n = localStorage.getItem("evacuaid-demo-phone");
      if (!n) {
        n = `+1626555${String(Math.floor(1000 + Math.random() * 9000))}`;
        localStorage.setItem("evacuaid-demo-phone", n);
      }
      return n;
    } catch {
      return DEFAULT_PHONE;
    }
  });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const me = live.households.find((h) => h.phone === normalizePhone(phone));
  const messages = me?.messages ?? [];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, pending]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setPending(text);
    setDraft("");
    try {
      await liveAction("/api/inbound", { phone, text });
    } finally {
      setSending(false);
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[760px] w-[360px] rounded-[54px] border border-white/10 bg-[#0a0a0c] p-3 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9),inset_0_0_0_2px_rgba(255,255,255,0.04)]">
        <div className="absolute left-1/2 top-5 z-10 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />
        <div className="flex h-full flex-col overflow-hidden rounded-[44px] bg-black">
          <div className="flex flex-col items-center gap-1.5 border-b border-white/[0.06] bg-[#111113]/90 px-4 pb-3 pt-14 backdrop-blur">
            <div className="grid size-11 place-items-center rounded-full bg-gradient-to-b from-[#2a2a2e] to-[#18181b]">
              <span className="relative grid size-5 place-items-center">
                <span className="absolute inset-0 rounded-full border border-out/50" />
                <span className="size-2 rounded-full bg-out shadow-[0_0_10px_var(--color-out)]" />
              </span>
            </div>
            <div className="text-[15px] font-medium">EvacuAid</div>
          </div>

          <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            {messages.length === 0 && !pending && (
              <p className="mt-24 px-6 text-center text-[15.5px] leading-relaxed text-faint">
                Waiting for an alert. Send it from the console, or text EvacuAid first.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "resident" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`rise max-w-[78%] rounded-[20px] px-3.5 py-2 text-[17px] leading-snug ${
                    m.from === "resident" ? "rounded-br-md bg-[#0a84ff] text-white" : "rounded-bl-md bg-[#26262a] text-fg"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {pending && !messages.some((m) => m.from === "resident" && m.text === pending) && (
              <div className="flex justify-end">
                <div className="max-w-[78%] rounded-[20px] rounded-br-md bg-[#0a84ff]/70 px-3.5 py-2 text-[17px] text-white">{pending}</div>
              </div>
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-[20px] rounded-bl-md bg-[#26262a] px-4 py-3">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="live-dot size-1.5 rounded-full bg-muted" style={{ animationDelay: `${d * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
            {suggestions(me?.conv?.stage).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => send(q)}
                className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-[14.5px] text-muted transition hover:text-fg"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-center gap-2 px-3 pb-7"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Text Message"
              className="flex-1 rounded-full border border-white/10 bg-transparent px-4 py-2 text-[17px] outline-none placeholder:text-faint focus:border-white/25"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              aria-label="Send"
              className="grid size-8 place-items-center rounded-full bg-[#0a84ff] text-white transition disabled:opacity-30"
            >
              ↑
            </button>
          </form>
        </div>
      </div>

      <label className="flex items-center gap-3">
        <span className="label text-[13px]">This phone</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-[170px] rounded-full border border-line-strong bg-transparent px-3 py-1.5 font-mono text-[15px] outline-none focus:border-white/30"
        />
      </label>
    </div>
  );
}
