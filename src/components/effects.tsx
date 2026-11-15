"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { rng } from "@/lib/rng";

/** Soft light that follows the cursor across the page. */
export function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: PointerEvent) => {
      el.style.setProperty("--x", `${e.clientX}px`);
      el.style.setProperty("--y", `${e.clientY}px`);
      el.style.opacity = "1";
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 opacity-0 transition-opacity duration-700"
      style={{
        background:
          "radial-gradient(520px circle at var(--x, 50%) var(--y, 50%), rgb(255 255 255 / 0.055), transparent 60%)",
      }}
    />
  );
}

/** Card that tilts toward the cursor with a moving glare. */
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const glare = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const g = glare.current;
    if (!el || !g) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1100px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(0)`;
      g.style.opacity = "1";
      g.style.background = `radial-gradient(420px circle at ${(px + 0.5) * 100}% ${(py + 0.5) * 100}%, rgb(255 255 255 / 0.10), transparent 55%)`;
    };
    const leave = () => {
      el.style.transform = "perspective(1100px) rotateY(0deg) rotateX(0deg)";
      g.style.opacity = "0";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`relative transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${className}`}
    >
      {children}
      <div
        ref={glare}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[22px] opacity-0 transition-opacity duration-500"
      />
    </div>
  );
}

const random = rng(7);
const EMBERS = Array.from({ length: 22 }, () => ({
  left: 45 + random() * 55,
  size: 1.5 + random() * 2.5,
  dur: 9 + random() * 10,
  delay: -random() * 18,
  drift: -60 + random() * 120,
}));

/** Sparks drifting up on the fire side of the page. */
export function Embers() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={
            {
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              "--dur": `${e.dur}s`,
              "--delay": `${e.delay}s`,
              "--drift": `${e.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
