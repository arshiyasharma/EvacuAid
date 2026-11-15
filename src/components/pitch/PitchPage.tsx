"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NavLinks } from "@/components/NavLinks";
import { Logo } from "@/components/ui";
import type { Counterfactual } from "@/lib/replay/counterfactual";
import {
  AFTER,
  CLAIM_EVACUAID,
  CLAIM_TODAY,
  HAZARDS,
  DIFFERENT,
  JOURNEY,
  MONEY_PROBLEM,
  NESSIE_CALLS,
  NEWS,
  PHASES,
  PHOTO,
  SOFTWARE,
  STACK,
  STORY,
  SWIM,
  SWIM_TIGER,
  TRACKS,
  TWO_RAILS,
  WHY_NOT_SAVED,
  type Track,
} from "./content";

type Story = { key: string; title: string; tag: string; address: string; messages: { from: "resident" | "evacuaid"; text: string; at: string }[] };
type Point = { x: number; y: number; t: number };

// ---------- motion helpers ----------

/** Adds `in` the first time an element scrolls into view. */
function useInView<T extends HTMLElement>(margin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView] as const;
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`film-reveal ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** 0 → 1 as a tall section scrolls past (for sticky scenes). */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      setP(Math.min(1, Math.max(0, -r.top / Math.max(1, total))));
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  return [ref, p] as const;
}

// ---------- the film ----------

export function PitchPage({ stories, cf, points }: { stories: Story[]; cf: Counterfactual; points: Point[] }) {
  return (
    <div className="relative min-h-dvh bg-ink text-fg">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-ink/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {[
              ["#story", "Story"],
              ["#problem", "Problem"],
              ["#solution", "Solution"],
              ["#demo", "Demo"],
              ["#how", "How it works"],
              ["#tracks", "Tracks"],
              ["#stack", "Stack"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3.5 py-1.5 text-[15px] text-muted transition hover:bg-white/[0.06] hover:text-fg">
                {label}
              </a>
            ))}
          </nav>
          <NavLinks className="hidden xl:flex" />
        </div>
      </header>

      <Opening />
      <StoryScene />
      <Clippings />
      <Problems />
      <Beyond />
      <Solution cf={cf} points={points} />
      <AnyDisaster />
      <DemoTime stories={stories} />
      <HowItWorks />
      <WhyNow />
      <Tracks />
      <Different />
      <StackSection />
      <Closing />
    </div>
  );
}

/** 1. The photo. Nothing else. */
function Opening() {
  return (
    <section className="relative h-dvh overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO.src} alt="Los Angeles at night from the International Space Station, wildfires burning around the city" className="film-kenburns absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,5,6,0.85)_80%),linear-gradient(180deg,rgba(5,5,6,0.4),rgba(5,5,6,0.1)_40%,#050506)]" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="film-in label text-ember" style={{ animationDelay: "300ms" }}>
          January 2025 · Los Angeles
        </div>
        <h1 className="film-in mt-5 max-w-[1000px] text-[clamp(48px,8vw,124px)] font-medium leading-[0.95] tracking-[-0.05em]" style={{ animationDelay: "700ms" }}>
          The night Altadena burned.
        </h1>
        <div className="film-in absolute bottom-10 flex flex-col items-center gap-2 text-[14px] text-faint" style={{ animationDelay: "1600ms" }}>
          <span className="film-bob">Scroll</span>
          <a href={PHOTO.page} target="_blank" rel="noreferrer" className="font-mono text-[12px] hover:text-muted">
            Photo: {PHOTO.credit}
          </a>
        </div>
      </div>
    </section>
  );
}

/** 2. One family. Each line arrives as you scroll. */
function StoryScene() {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const steps = STORY.lines.length + 1;
  const shown = Math.min(steps, Math.floor(p * (steps + 0.6)) + 1);
  return (
    <section id="story" ref={ref} className="relative" style={{ height: "320vh" }}>
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(255,77,58,0.22),transparent_60%)]" />
        <div className="relative mx-auto w-full max-w-[1100px] px-6">
          {STORY.lines.map((l, i) => (
            <p
              key={l}
              className={`text-[clamp(24px,3.3vw,46px)] font-medium leading-[1.15] tracking-[-0.03em] transition-all duration-700 ${
                i < shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-6 opacity-0 blur-sm"
              } ${i < shown - 1 ? "text-muted" : "text-fg"}`}
              style={{ marginTop: i ? 18 : 0 }}
            >
              {l}
            </p>
          ))}
          <p
            className={`mt-8 text-[clamp(52px,8vw,120px)] font-semibold leading-none tracking-[-0.05em] text-help transition-all duration-1000 ${
              shown > STORY.lines.length ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
            style={{ textShadow: "0 0 60px rgba(255,77,58,0.5)" }}
          >
            {STORY.punch}
          </p>
          <a
            href={STORY.source}
            target="_blank"
            rel="noreferrer"
            className={`mt-6 inline-block text-[15px] text-faint transition-opacity duration-700 hover:text-muted ${shown > STORY.lines.length ? "opacity-100" : "opacity-0"}`}
          >
            NPR, January 13, 2025 ↗
          </a>
        </div>
      </div>
    </section>
  );
}

/** 3. The coverage drifts past. Then the number. */
function Clippings() {
  const [ref, p] = useScrollProgress<HTMLElement>();
  const lanes = [NEWS.slice(0, 3), NEWS.slice(3, 6), AFTER];
  return (
    <section ref={ref} className="relative" style={{ height: "220vh" }}>
      <div className="sticky top-0 flex h-dvh flex-col justify-center overflow-hidden">
        <div className="space-y-5">
          {lanes.map((lane, li) => (
            <div
              key={li}
              className="flex gap-5 whitespace-nowrap will-change-transform"
              style={{ transform: `translateX(${(li % 2 ? -1 : 1) * (p * 38 - 19) - 10}%)` }}
            >
              {[...lane, ...lane].map((n, i) => (
                <a
                  key={`${n.url}-${i}`}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-block w-[420px] shrink-0 whitespace-normal rounded-3xl border p-6 transition hover:-translate-y-1 ${
                    li === 2 ? "border-silent/30 bg-silent/[0.07]" : "border-line bg-raised/80"
                  }`}
                >
                  <div className={`label text-[12px] ${li === 2 ? "text-silent" : "text-ember"}`}>{n.outlet}</div>
                  <div className="mt-3 text-[21px] font-medium leading-snug">{n.headline}</div>
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgba(5,5,6,0.92)_25%,transparent_70%)]">
          <div className="text-center" style={{ opacity: Math.min(1, Math.max(0, (p - 0.25) * 3)) }}>
            <div className="font-mono text-[clamp(72px,12vw,180px)] font-light leading-none tracking-tight">
              18<span className="text-faint">/</span>19
            </div>
            <div className="mt-3 text-[clamp(20px,2.4vw,30px)] text-muted">died where the evacuation order came last.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 4. Two problems, side by side. */
function Problems() {
  return (
    <section id="problem" className="mx-auto max-w-[1240px] scroll-mt-20 px-6 py-28">
      <Reveal>
        <div className="label">The problem is two-fold</div>
        <h2 className="mt-4 text-[clamp(40px,5.4vw,80px)] font-medium leading-[0.98] tracking-[-0.045em]">
          They couldn&apos;t get out.
          <br />
          <span className="text-muted">Then they couldn&apos;t get help.</span>
        </h2>
      </Reveal>
      <div className="mt-16 grid gap-10 lg:grid-cols-2">
        <div>
          <Reveal>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[15px] text-help">01</span>
              <h3 className="text-[32px] font-medium tracking-[-0.02em]">Evacuation</h3>
            </div>
          </Reveal>
          <div className="mt-6 space-y-3">
            {WHY_NOT_SAVED.map((w, i) => (
              <Reveal key={w.title} delay={i * 90}>
                <div className="flex items-center gap-5 rounded-3xl border border-line bg-raised/60 p-5">
                  <span className="w-[120px] shrink-0 font-mono text-[26px] text-help">{w.n}</span>
                  <span>
                    <span className="block text-[19px] font-medium">{w.title}</span>
                    <span className="block text-[15px] text-muted">{w.body}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <div>
          <Reveal>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[15px] text-silent">02</span>
              <h3 className="text-[32px] font-medium tracking-[-0.02em]">Relief money</h3>
            </div>
          </Reveal>
          <div className="mt-6 space-y-3">
            {MONEY_PROBLEM.map((m, i) => (
              <Reveal key={m.title} delay={i * 90}>
                <a
                  href={m.url}
                  target={m.url ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex items-center gap-5 rounded-3xl border border-line bg-raised/60 p-5 transition hover:border-line-strong"
                >
                  <span className="w-[120px] shrink-0 font-mono text-[24px] text-silent">{m.n}</span>
                  <span>
                    <span className="block text-[19px] font-medium">{m.title}</span>
                    <span className="block text-[15px] text-muted">
                      {m.body}
                      {m.url && " ↗"}
                    </span>
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FLOW_EVAC = ["Alert, two-way, hours early", "Reply in any language", "A case: ride, aid, or door knock", "Operator dispatches", "Checked in at the shelter"];
const FLOW_MONEY = ["Two questions size the aid", "Five bank checks on Nessie", "Donor pool releases on Solana", "A card that only evacuates", "Every dollar traceable"];

/** 5. One app for both. The flows build, then the proof. */
function Solution({ cf, points }: { cf: Counterfactual; points: Point[] }) {
  const [barsRef, barsIn] = useInView<HTMLDivElement>("0px 0px -20% 0px");
  const bars = [
    { label: "With EvacuAid", sub: "two-way, 6:49 PM", v: cf.evacuaid.people.mean, color: "var(--color-out)" },
    { label: "Alert at first satellite sighting", sub: "one-way, 1:02 AM", v: cf.satellite.people.mean, color: "var(--color-silent)" },
    { label: "That night", sub: "one-way, 3:25 AM", v: cf.alerts.people.mean, color: "var(--color-help)" },
  ];
  return (
    <section id="solution" className="relative scroll-mt-20 overflow-hidden py-28">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(62,224,127,0.12),transparent_60%)]" />
      <div className="relative mx-auto max-w-[1240px] px-6">
        <Reveal>
          <div className="label text-out">The solution</div>
          <h2 className="mt-4 text-[clamp(44px,6vw,96px)] font-medium leading-[0.95] tracking-[-0.05em]">
            One app for <span className="shimmer">both</span>.
          </h2>
          <p className="mt-4 text-[clamp(18px,1.8vw,22px)] text-muted">Shown on a wildfire. Built for any evacuation.</p>
        </Reveal>
        <Reveal delay={150}>
          <div className="mt-8 grid max-w-[980px] gap-2 text-[16.5px] sm:grid-cols-3">
            <div className="rounded-2xl border border-[#ff5a4f]/30 bg-[#ff5a4f]/[0.06] px-4 py-3">
              <span className="font-mono text-[13px] text-[#ff5a4f]">1 · NESSIE </span>pays the family in seconds, from the county&apos;s fund.
            </div>
            <div className="rounded-2xl border border-[#14f195]/30 bg-[#14f195]/[0.06] px-4 py-3">
              <span className="font-mono text-[13px] text-[#14f195]">2 · SOLANA </span>donors pay the county back, by rules no one can change.
            </div>
            <div className="rounded-2xl border border-[#f5c518]/30 bg-[#f5c518]/[0.06] px-4 py-3">
              <span className="font-mono text-[13px] text-[#f5c518]">3 · TIGER </span>remembers every step, so anyone can follow the dollar.
            </div>
          </div>
        </Reveal>

        <div className="mt-16 grid items-start gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <FlowColumn title="Get everyone out" color="var(--color-help)" steps={FLOW_EVAC} />
          <Reveal delay={600} className="hidden self-center lg:block">
            <div className="grid size-28 place-items-center rounded-full border border-out/40 bg-out/10 text-center text-[15px] font-medium text-out shadow-[0_0_60px_-10px_var(--color-out)]">
              Same
              <br />
              night
            </div>
          </Reveal>
          <FlowColumn title="Get them the money" color="var(--color-silent)" steps={FLOW_MONEY} />
        </div>

        <div ref={barsRef} className="mt-24 grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <Reveal>
            <FireMini points={points} />
          </Reveal>
          <div>
            <Reveal>
              <div className="label">On the real fire · {cf.runs} paired runs</div>
              <div className="mt-3 flex items-baseline gap-4">
                <span className="font-mono text-[clamp(64px,8vw,112px)] font-light leading-none text-out">+{Math.round(cf.extraPeople.mean)}</span>
                <span className="text-[22px] text-muted">
                  people reached before the fire
                  <span className="block font-mono text-[14px] text-faint">
                    {cf.extraPeople.high - cf.extraPeople.low < 1
                      ? `the same gain in all ${cf.runs} paired runs`
                      : `95% CI ${Math.round(cf.extraPeople.low)} to ${Math.round(cf.extraPeople.high)}`}
                  </span>
                </span>
              </div>
            </Reveal>
            <div className="mt-8 space-y-5">
              {bars.map((b, i) => (
                <div key={b.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[19px]">
                      {b.label} <span className="text-[15px] text-faint">· {b.sub}</span>
                    </span>
                    <span className="font-mono text-[26px]" style={{ color: b.color }}>
                      {Math.round(b.v)}
                      <span className="text-[16px] text-faint"> / {cf.needPeople}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-[width] ease-out"
                      style={{
                        width: barsIn ? `${(b.v / cf.needPeople) * 100}%` : "0%",
                        background: b.color,
                        boxShadow: `0 0 20px ${b.color}`,
                        transitionDuration: "1600ms",
                        transitionDelay: `${i * 250}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[14px] text-faint">Same {cf.needHouseholds} homes, 22 vehicles, NASA fire timing. The baseline even knows who needs a ride.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowColumn({ title, color, steps }: { title: string; color: string; steps: string[] }) {
  return (
    <div>
      <Reveal>
        <div className="text-[26px] font-medium" style={{ color }}>
          {title}
        </div>
      </Reveal>
      <ol className="mt-5 space-y-3">
        {steps.map((s, i) => (
          <Reveal key={s} delay={i * 140}>
            <li className="flex items-center gap-4 rounded-2xl border border-line bg-raised/70 px-5 py-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-full font-mono text-[14px] text-ink" style={{ background: color }}>
                {i + 1}
              </span>
              <span className="text-[18px]">{s}</span>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

function FireMini({ points }: { points: Point[] }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="relative aspect-square overflow-hidden rounded-[32px] border border-line bg-surface">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="ember-pt">
            <stop offset="0%" stopColor="#ffd166" />
            <stop offset="50%" stopColor="#ff7a1a" />
            <stop offset="100%" stopColor="#ff4d3a" stopOpacity="0" />
          </radialGradient>
        </defs>
        {inView &&
          points.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={2.6} fill="url(#ember-pt)" className="fire-dot" style={{ animationDelay: `${(pt.t * 3.5).toFixed(2)}s` }} />
          ))}
      </svg>
      <div className="absolute left-4 top-4 font-mono text-[13px] text-muted">{points.length} NASA satellite detections · the real fire</div>
    </div>
  );
}

/** 4b. Where everyone else stops. */
function Beyond() {
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px -25% 0px");
  return (
    <section className="relative overflow-hidden py-28">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(62,224,127,0.08),transparent_60%)]" />
      <div className="relative mx-auto max-w-[1240px] px-6">
        <Reveal>
          <div className="label">Where everyone else stops</div>
          <h2 className="mt-4 max-w-[16ch] text-[clamp(40px,5.4vw,80px)] font-medium leading-[0.98] tracking-[-0.045em]">
            Getting out is half of it.
          </h2>
          <p className="mt-5 max-w-[34ch] text-[clamp(20px,2vw,26px)] leading-snug text-muted">
            EvacuAid stays with them until the aid is in their hands, and the donor can see it.
          </p>
        </Reveal>

        <div ref={ref} className="mt-16 overflow-x-auto pb-2">
          <div className="relative grid min-w-[880px] grid-cols-5 gap-3">
            <div className="absolute left-0 right-0 top-[27px] h-[3px] rounded-full bg-white/[0.06]" />
            <div
              className="absolute left-0 top-[27px] h-[3px] origin-left rounded-full bg-out shadow-[0_0_18px_var(--color-out)] transition-transform ease-out"
              style={{ right: 0, transform: `scaleX(${inView ? 1 : 0})`, transitionDuration: "2200ms" }}
            />
            {JOURNEY.map((j, i) => (
              <div key={j.step} className="relative">
                <div
                  className="relative z-10 grid size-14 place-items-center rounded-full border-2 border-out bg-ink font-mono text-[17px] text-out transition-all duration-500"
                  style={{ transitionDelay: `${i * 420}ms`, opacity: inView ? 1 : 0.2, transform: inView ? "scale(1)" : "scale(0.8)" }}
                >
                  {i + 1}
                </div>
                <div className="mt-5 text-[26px] font-medium tracking-[-0.02em]">{j.step}</div>
                <div className="mt-1 text-[16px] leading-snug text-muted">{j.body}</div>
                {j.stop && (
                  <div className="absolute -right-2 top-0 hidden h-[150px] border-r border-dashed border-white/25 md:block">
                    <span className="absolute -top-7 right-2 whitespace-nowrap font-mono text-[12px] uppercase tracking-wide text-faint">{j.stop}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <Reveal delay={200}>
          <div className="mt-20 grid gap-6 rounded-[36px] border border-out/25 bg-out/[0.05] p-8 md:grid-cols-[1fr_auto] md:items-center sm:p-10">
            <p className="text-[clamp(26px,3vw,40px)] font-medium leading-tight tracking-[-0.02em]">
              People give when they can see where it goes.
              <span className="text-muted"> Every donor gets a receipt naming the families their gift reached.</span>
            </p>
            <Link href="/donate" className="justify-self-start rounded-full bg-out px-6 py-3.5 text-[17px] font-medium text-ink transition hover:brightness-110">
              See a receipt →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** 7. The flowchart: phases left to right, one row per system. */
function HowItWorks() {
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px -15% 0px");
  return (
    <section id="how" className="mx-auto max-w-[1240px] scroll-mt-20 px-6 py-24">
      <Reveal>
        <div className="label">How it works</div>
        <h2 className="mt-4 text-[clamp(40px,5.4vw,80px)] font-medium leading-[0.98] tracking-[-0.045em]">One night, end to end.</h2>
      </Reveal>

      <div ref={ref} className="mt-12 overflow-x-auto pb-3">
        <div className="grid min-w-[1060px] grid-cols-[150px_repeat(6,minmax(0,1fr))] gap-2">
          <div />
          {PHASES.map((ph, i) => (
            <div
              key={ph}
              className="flex items-center gap-2 px-1 pb-2 transition-opacity duration-500"
              style={{ opacity: inView ? 1 : 0, transitionDelay: `${i * 180}ms` }}
            >
              <span className="font-mono text-[12px] text-faint">0{i + 1}</span>
              <span className="text-[15px] font-medium">{ph}</span>
              {i < PHASES.length - 1 && <span className="ml-auto text-faint">→</span>}
            </div>
          ))}

          {SWIM.map((row) => (
            <div key={row.who} className="contents">
              <div className="flex items-center gap-2 pr-2 text-[15.5px] font-medium" style={{ color: row.color }}>
                <span className="size-2 shrink-0 rounded-full" style={{ background: row.color }} />
                {row.who}
              </div>
              {row.cells.map((c, i) =>
                c ? (
                  <div
                    key={i}
                    className="rounded-2xl border p-3 transition-all duration-500"
                    style={{
                      borderColor: `color-mix(in srgb, ${row.color} 28%, transparent)`,
                      background: `color-mix(in srgb, ${row.color} 6%, #0c0c0f)`,
                      opacity: inView ? 1 : 0,
                      transform: inView ? "translateY(0)" : "translateY(8px)",
                      transitionDelay: `${i * 180 + 100}ms`,
                    }}
                  >
                    <div className="font-mono text-[12.5px]" style={{ color: row.color }}>
                      {c.key}
                    </div>
                    <div className="mt-1 text-[14px] leading-snug text-muted">{c.text}</div>
                  </div>
                ) : (
                  <div key={i} className="grid place-items-center">
                    <span className="h-px w-full bg-white/[0.06]" />
                  </div>
                ),
              )}
            </div>
          ))}

          <div className="flex items-center gap-2 pr-2 text-[15.5px] font-medium text-[#f5c518]">
            <span className="size-2 shrink-0 rounded-full bg-[#f5c518]" />
            Tiger Data
          </div>
          <div
            className="col-span-6 rounded-2xl border border-[#f5c518]/30 bg-[#f5c518]/[0.06] px-4 py-3 text-[14.5px] transition-opacity duration-700"
            style={{ opacity: inView ? 1 : 0, transitionDelay: "1300ms" }}
          >
            <span className="font-mono text-[12.5px] text-[#f5c518]">evac_events · </span>
            {SWIM_TIGER}
          </div>
        </div>
      </div>
      <Priority />
    </section>
  );
}

/** Who goes first: the same formula the console shows on every household. */
function Priority() {
  const terms = [
    { sym: "A", text: "when the hazard reaches the home (for fire: satellite spread rate)" },
    { sym: "T", text: "how long they need to leave alone: no car ≥ 240 min, asked for help 360" },
    { sym: "σ", text: "0.35, the fire's timing uncertainty" },
    { sym: "wᵢ", text: "medical 0.6 · can't walk 0.5 · someone left at home 0.4 · 75+ 0.3 · silent 0.3 · kids 0.15 · not English 0.1" },
  ];
  return (
    <Reveal>
      <div className="mt-16 rounded-[36px] border border-line bg-raised/50 p-7 sm:p-9">
        <div className="label">Who goes first</div>
        <div className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="space-y-3 font-mono text-[clamp(17px,1.8vw,22px)]">
            <div>
              <span className="text-help">P</span> = Φ( (ln <span className="text-fg">T</span> − ln <span className="text-fg">A</span>) / σ )
              <span className="ml-3 font-sans text-[14px] text-faint">chance the fire wins the race</span>
            </div>
            <div>
              <span className="text-silent">V</span> = 1 − Π (1 − wᵢ)
              <span className="ml-3 font-sans text-[14px] text-faint">harm if they&apos;re trapped</span>
            </div>
            <div className="text-[clamp(22px,2.4vw,30px)]">
              priority = <span className="text-help">P</span> × <span className="text-silent">V</span>
            </div>
            <div className="font-sans text-[15.5px] text-muted">
              Highest first → the nearest free vehicle that can carry them (wheelchair-capable when needed). The operator approves.
            </div>
          </div>
          <div>
            <ul className="space-y-2 text-[14.5px] text-muted">
              {terms.map((t) => (
                <li key={t.sym} className="flex gap-3">
                  <span className="w-6 shrink-0 font-mono text-fg">{t.sym}</span>
                  {t.text}
                </li>
              ))}
            </ul>
            <div className="mt-5 grid grid-cols-2 gap-2 text-[14.5px]">
              <div className="rounded-2xl border border-help/30 bg-help/[0.06] p-3">
                <div className="font-mono text-[24px] text-help">0.82</div>
                Wheelchair + oxygen, fire 90 min out
              </div>
              <div className="rounded-2xl border border-line p-3">
                <div className="font-mono text-[24px] text-muted">0.05</div>
                Family with a car, same street
              </div>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** 8. Two reasons, side by side: two rails, and why not later. */
function WhyNow() {
  const [ref, inView] = useInView<HTMLDivElement>("0px 0px -20% 0px");
  const rows = [
    { who: "Relief today", when: "Weeks to months", steps: CLAIM_TODAY, width: 100, color: "var(--color-help)" },
    { who: "EvacuAid", when: "Seconds", steps: CLAIM_EVACUAID, width: 4, color: "var(--color-out)" },
  ];
  return (
    <section className="mx-auto grid max-w-[1240px] gap-6 px-6 pb-24 lg:grid-cols-2">
      <Reveal className="h-full">
        <div className="h-full rounded-[36px] border border-line bg-raised/50 p-7 sm:p-9">
          <h3 className="text-[clamp(28px,3vw,40px)] font-medium leading-tight tracking-[-0.03em]">Why two money rails?</h3>
          <div className="mt-6 space-y-4">
            {TWO_RAILS.map((r) => (
              <div key={r.name} className="rounded-2xl border p-5" style={{ borderColor: `color-mix(in srgb, ${r.color} 35%, transparent)`, background: `color-mix(in srgb, ${r.color} 6%, #0c0c0f)` }}>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-mono text-[13px]" style={{ color: r.color }}>
                    {r.name.toUpperCase()}
                  </span>
                  <span className="text-[20px] font-medium">{r.job}</span>
                </div>
                <p className="mt-2 text-[15.5px] leading-snug text-muted">{r.body}</p>
                <p className="mt-2 text-[14.5px] text-faint">Alone it {r.cant.charAt(0).toLowerCase() + r.cant.slice(1)}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
      <Reveal delay={150} className="h-full">
        <div ref={ref} className="h-full rounded-[36px] border border-line bg-raised/50 p-7 sm:p-9">
          <h3 className="text-[clamp(28px,3vw,40px)] font-medium leading-tight tracking-[-0.03em]">Why this can&apos;t wait for a claim.</h3>
          <p className="mt-2 text-[16px] text-muted">People stay because leaving costs money. Aid after the fire gets no one out.</p>
          <div className="mt-7 space-y-7">
            {rows.map((r, i) => (
              <div key={r.who}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[19px] font-medium" style={{ color: r.color }}>
                    {r.who}
                  </span>
                  <span className="font-mono text-[24px] font-light" style={{ color: r.color }}>
                    {r.when}
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full transition-[width] ease-out"
                    style={{
                      width: inView ? `${r.width}%` : "0%",
                      minWidth: inView ? 14 : 0,
                      background: r.color,
                      boxShadow: `0 0 18px ${r.color}`,
                      transitionDuration: i ? "500ms" : "2400ms",
                      transitionDelay: i ? "1300ms" : "0ms",
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[14px]">
                  {r.steps.map((st, k) => (
                    <span key={st} className="flex items-center gap-1.5">
                      <span className={`rounded-full border px-2.5 py-0.5 ${i ? "border-out/40 text-fg" : "border-line text-muted"}`}>{st}</span>
                      {k < r.steps.length - 1 && <span className="text-faint">→</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-faint">
            {AFTER.map((a) => (
              <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="hover:text-muted">
                {a.outlet} ↗
              </a>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** Fire is the proof, not the limit. */
function AnyDisaster() {
  return (
    <section className="mx-auto max-w-[1240px] px-6 pb-24">
      <Reveal>
        <h2 className="text-[clamp(32px,4vw,56px)] font-medium leading-tight tracking-[-0.04em]">
          Fire is the proof. <span className="text-muted">Not the limit.</span>
        </h2>
        <p className="mt-3 max-w-[60ch] text-[18px] text-muted">
          Roll call, triage, priority, vans, aid and donor receipts don&apos;t care what the disaster is. Only the feed that says
          when it reaches each home changes.
        </p>
      </Reveal>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {HAZARDS.map((h, i) => (
          <Reveal key={h.name} delay={i * 80}>
            <div className={`h-full rounded-3xl border p-5 ${h.live ? "border-ember/40 bg-ember/[0.07]" : "border-line bg-raised/50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-[20px] font-medium">{h.name}</span>
                {h.live && <span className="rounded-full bg-ember/20 px-2 py-0.5 font-mono text-[11px] text-ember">DEMO</span>}
              </div>
              <div className="mt-2 font-mono text-[13px] text-faint">{h.feed}</div>
              <div className="mt-2 text-[15px] leading-snug text-muted">{h.note}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** 6. Demo time. */
const DEMO_TABS = [
  { key: "stories", label: "Situations" },
  { key: "console", label: "Operator portal", src: "/console", note: "Your sector. EvacuAid suggests the van or the amount. You approve." },
  { key: "relief", label: "Relief fund", src: "/relief", note: "Live Nessie + Solana transactions, Tiger Data charts, the budget simulator." },
  { key: "donate", label: "Donate", src: "/donate", note: "Give on Solana. See which families your gift reached." },
] as const;

function DemoTime({ stories }: { stories: Story[] }) {
  const [tab, setTab] = useState<(typeof DEMO_TABS)[number]["key"]>("stories");
  const active = DEMO_TABS.find((d) => d.key === tab)!;
  return (
    <section id="demo" className="mx-auto max-w-[1240px] scroll-mt-20 px-6 py-28">
      <Reveal>
        <h2 className="text-center text-[clamp(64px,10vw,150px)] font-medium leading-none tracking-[-0.06em]">
          Demo <span className="text-out">time.</span>
        </h2>
        <a
          href="/#signup"
          target="_blank"
          rel="noreferrer"
          className="mx-auto mt-8 flex max-w-[560px] items-center justify-between gap-4 rounded-full border border-out/40 bg-out/[0.08] py-3 pl-6 pr-3 transition hover:bg-out/[0.14]"
        >
          <span className="text-[17px]">
            <span className="font-medium text-out">In-person demo:</span> add your number, get the alert on your phone
          </span>
          <span className="shrink-0 rounded-full bg-out px-4 py-2 text-[15px] font-medium text-ink">Sign up →</span>
        </a>
      </Reveal>
      <div className="mt-10 flex flex-wrap justify-center gap-2">
        {DEMO_TABS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setTab(d.key)}
            className={`rounded-full px-6 py-3 text-[17px] transition ${tab === d.key ? "bg-fg font-medium text-ink" : "border border-line-strong text-muted hover:text-fg"}`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {tab === "stories" ? (
        <Stories stories={stories} />
      ) : (
        <div className="mt-8">
          <p className="text-center text-[19px] text-muted">{"note" in active ? active.note : ""}</p>
          <Embed src={"src" in active ? active.src : "/"} />
        </div>
      )}
    </section>
  );
}

function Embed({ src }: { src: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1440));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="mt-5">
      <div ref={box} className="relative aspect-[16/10] w-full overflow-hidden rounded-[28px] border border-line-strong bg-black">
        <iframe title={src} src={src} loading="lazy" className="absolute left-0 top-0 origin-top-left border-0" style={{ width: 1440, height: 900, transform: `scale(${scale})` }} />
      </div>
      <div className="mt-3 text-center">
        <Link href={src} className="text-[16px] text-muted underline decoration-white/20 underline-offset-4 hover:text-fg">
          Open full page ↗
        </Link>
      </div>
    </div>
  );
}

function Stories({ stories }: { stories: Story[] }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(1);
  const s = stories[i];
  useEffect(() => {
    const t = setInterval(() => setShown((n) => (n < s.messages.length ? n + 1 : n)), 1300);
    return () => clearInterval(t);
  }, [i, s.messages.length]);
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[340px_1fr]">
      <ul className="space-y-2">
        {stories.map((st, k) => (
          <li key={st.key}>
            <button
              type="button"
              onClick={() => {
                setI(k);
                setShown(1);
              }}
              className={`w-full rounded-2xl border px-5 py-3.5 text-left transition ${k === i ? "border-out/50 bg-out/[0.08]" : "border-line hover:bg-white/[0.03]"}`}
            >
              <div className="text-[18px]">{st.title}</div>
              <div className="text-[14px] text-faint">{st.tag}</div>
            </button>
          </li>
        ))}
      </ul>
      <div className="mx-auto w-full max-w-[440px] rounded-[48px] border border-white/10 bg-[#0a0a0c] p-3 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        <div className="flex h-[640px] flex-col overflow-hidden rounded-[38px] bg-black">
          <div className="border-b border-white/10 py-3 text-center">
            <div className="text-[16px] font-medium">EvacuAid</div>
            <div className="text-[12px] text-faint">{s.address}</div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {s.messages.slice(0, shown).map((m, k) => (
                <div key={k} className={`rise flex flex-col ${m.from === "resident" ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[86%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug ${
                      m.from === "resident" ? "rounded-br-md bg-[#0a84ff] text-white" : "rounded-bl-md bg-[#26262a]"
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="mt-0.5 font-mono text-[11px] text-faint">{m.at}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 7. Tracks: pick one, see only that one. */
function Tracks() {
  const [key, setKey] = useState(TRACKS[0].key);
  const t = TRACKS.find((x) => x.key === key)!;
  return (
    <section id="tracks" className="mx-auto max-w-[1240px] scroll-mt-20 px-6 py-28">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="text-[clamp(44px,6vw,88px)] font-medium leading-none tracking-[-0.05em]">Pick a track.</h2>
          <label className="relative">
            <span className="sr-only">Sponsor track</span>
            <select
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="appearance-none rounded-2xl border border-line-strong bg-raised py-4 pl-5 pr-14 text-[19px] font-medium outline-none focus:border-white/40"
            >
              {TRACKS.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-muted">▾</span>
          </label>
        </div>
      </Reveal>
      <TrackPanel key={t.key} t={t} />
    </section>
  );
}

function TrackPanel({ t }: { t: Track }) {
  const groups = [...new Set(t.features.map((f) => f.group ?? "Features"))];
  return (
    <div
      className="film-swap relative mt-10 overflow-hidden rounded-[44px] border p-6 sm:p-10"
      style={{ borderColor: `color-mix(in srgb, ${t.color} 35%, transparent)`, background: `linear-gradient(160deg, color-mix(in srgb, ${t.color} 13%, #0c0c0f), #0c0c0f 60%)` }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-10 select-none whitespace-nowrap text-[clamp(110px,20vw,280px)] font-bold leading-none tracking-[-0.06em] opacity-[0.07]"
        style={{ color: t.color }}
        aria-hidden
      >
        {t.name.split(" · ").pop()}
      </div>
      <div className="relative">
        <p className="max-w-[30ch] text-[clamp(26px,3vw,40px)] font-medium leading-tight tracking-[-0.02em]">{t.oneLiner}</p>

        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {t.proof.map((p) => (
            <div key={p.label} className="rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="font-mono text-[34px] leading-none" style={{ color: t.color }}>
                {p.n}
              </div>
              <div className="mt-2 text-[15px] text-muted">{p.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {t.irreplaceable.map((x, i) => (
            <div key={x} className="rounded-3xl border border-white/10 bg-black/25 p-5">
              <div className="font-mono text-[13px]" style={{ color: t.color }}>
                WHY IT&apos;S IRREPLACEABLE · {i + 1}
              </div>
              <div className="mt-2 text-[17px] leading-snug">{x}</div>
            </div>
          ))}
        </div>

        {groups.map((g) => (
          <div key={g} className="mt-10">
            <div className="flex items-center gap-3">
              <span className="size-2 rounded-full" style={{ background: t.color }} />
              <span className="text-[20px] font-medium">{g}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {t.features
                .filter((f) => (f.group ?? "Features") === g)
                .map((f) => (
                  <div key={f.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-white/20">
                    <div className="text-[19px] font-medium">{f.title}</div>
                    <div className="mt-1.5 text-[15px] leading-snug text-muted">{f.body}</div>
                    {f.why && (
                      <div className="mt-3 border-t border-white/10 pt-3 text-[15px] leading-snug" style={{ color: t.color }}>
                        <span className="font-mono text-[12px] opacity-70">WHY </span>
                        {f.why}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}

        {t.key === "nessie" && (
          <div className="mt-12 rounded-[32px] border border-[#ff5a4f]/35 bg-black/30 p-6 sm:p-8">
            <h3 className="text-[clamp(26px,3vw,40px)] font-medium leading-tight tracking-[-0.03em]">Every dollar is a real Nessie transaction.</h3>
            <ul className="mt-6 grid gap-x-8 gap-y-4 md:grid-cols-2">
              {NESSIE_CALLS.map((c) => (
                <li key={c.call} className="flex gap-3">
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-[#ff5a4f] shadow-[0_0_8px_#ff5a4f]" aria-hidden />
                  <div>
                    <div className="font-mono text-[14.5px]">{c.call}</div>
                    <div className="mt-0.5 text-[15px] leading-snug text-muted">{c.why}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-8">
          <div className="flex flex-wrap gap-2">
            {(t.key === "nessie" ? [] : t.apis).map((a) => (
              <span key={a} className="rounded-full border border-white/12 bg-black/30 px-3 py-1.5 font-mono text-[13.5px] text-muted">
                {a}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {t.links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target={l.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="rounded-full px-5 py-3 text-[16px] font-medium text-ink transition hover:brightness-110"
                style={{ background: t.color }}
              >
                {l.label} →
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 8. How I'm different. */
function Different() {
  return (
    <section className="mx-auto max-w-[1240px] px-6 py-28">
      <Reveal>
        <h2 className="text-[clamp(40px,5.4vw,80px)] font-medium leading-none tracking-[-0.045em]">How it&apos;s different.</h2>
      </Reveal>
      <div className="mt-10 space-y-2">
        <div className="hidden gap-4 px-6 font-mono text-[12.5px] uppercase tracking-wide md:grid md:grid-cols-[200px_1fr_1.4fr]">
          <span />
          <span className="text-faint">Evacuation tools</span>
          <span className="text-out">EvacuAid</span>
        </div>
        {DIFFERENT.map(([what, them, us], i) => (
          <Reveal key={what} delay={i * 70}>
            <div className="grid items-center gap-4 rounded-3xl border border-line bg-raised/50 px-6 py-5 md:grid-cols-[200px_1fr_1.4fr]">
              <span className="text-[19px] font-medium">{what}</span>
              <span className="text-[17px] text-faint line-through decoration-white/20">{them}</span>
              <span className="text-[18px] text-out">{us}</span>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <div className="mt-16 flex flex-wrap items-baseline justify-between gap-4">
          <h3 className="text-[32px] font-medium tracking-[-0.02em]">Built solo, built like software.</h3>
        </div>
      </Reveal>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {SOFTWARE.map((s, i) => (
          <Reveal key={s.label} delay={i * 70}>
            <div className="rounded-3xl border border-line bg-raised/50 p-5">
              <div className="font-mono text-[36px] leading-none">{s.n}</div>
              <div className="mt-2 text-[15px] leading-snug text-muted">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** 9. The stack, searchable. */
function StackSection() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = STACK.filter((s) => !query || `${s.name} ${s.what} ${s.cat}`.toLowerCase().includes(query));
  const cats = [...new Set(STACK.map((s) => s.cat))];
  return (
    <section id="stack" className="mx-auto max-w-[1240px] scroll-mt-20 px-6 py-28">
      <Reveal>
        <h2 className="text-[clamp(40px,5.4vw,80px)] font-medium leading-none tracking-[-0.045em]">Every technology.</h2>
      </Reveal>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: solana, nessie, maps, security…"
          className="min-w-[280px] flex-1 rounded-2xl border border-line-strong bg-raised px-5 py-4 text-[18px] outline-none placeholder:text-faint focus:border-white/40"
        />
        <span className="font-mono text-[14px] text-faint">
          {list.length} of {STACK.length}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setQ(q.toLowerCase() === c.toLowerCase() ? "" : c)}
            className={`rounded-full px-3.5 py-1.5 text-[14px] transition ${q.toLowerCase() === c.toLowerCase() ? "bg-fg text-ink" : "border border-line text-muted hover:text-fg"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <div key={s.name} className="rounded-2xl border border-line bg-raised/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[18px] font-medium">{s.name}</span>
              <span className="label text-[11px]">{s.cat}</span>
            </div>
            <div className="mt-1 text-[15px] text-muted">{s.what}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 10. Close. */
function Closing() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-32 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(62,224,127,0.16),transparent_60%)]" />
      <Reveal>
        <h2 className="relative text-[clamp(56px,9vw,140px)] font-medium leading-[0.92] tracking-[-0.055em]">
          Out safe.
          <br />
          <em className="shimmer pr-2 italic">Aid tonight.</em>
        </h2>
      </Reveal>
      <div className="relative mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/#signup" className="rounded-full bg-fg px-7 py-3.5 text-[18px] font-medium text-ink transition hover:bg-white">
          Get the alert on your phone
        </Link>
        {[
          ["/console", "Console"],
          ["/relief", "Relief fund"],
          ["/donate", "Donate"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-line-strong px-7 py-3.5 text-[18px] transition hover:bg-white/[0.06]">
            {label}
          </Link>
        ))}
      </div>
      <p className="relative mt-12 text-[14px] text-faint">EvacuAid · built solo at HackUMass XIV · Shown on the Eaton fire; built for any evacuation. Residents simulated; the fire and the streets are real.</p>
    </section>
  );
}
