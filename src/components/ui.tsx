import type { ReactNode } from "react";
import type { Status } from "@/lib/types";

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  needs_help: { label: "Needs help", color: "var(--color-help)" },
  no_response: { label: "No response", color: "var(--color-silent)" },
  leaving: { label: "Leaving", color: "var(--color-leaving)" },
  out: { label: "Out", color: "var(--color-out)" },
};

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid size-6 place-items-center">
        <span className="pulse-ring absolute inset-0 rounded-full border border-out/50" />
        <span className="absolute inset-0 rounded-full border border-out/40" />
        <span className="size-2 rounded-full bg-out shadow-[0_0_12px_var(--color-out)]" />
      </span>
      <span className="text-[18px] font-semibold tracking-[-0.025em] text-fg">EvacuAid</span>
    </span>
  );
}

export function LiveTag({ children, color = "var(--color-out)" }: { children: ReactNode; color?: string }) {
  return (
    <span className="label inline-flex items-center gap-2">
      <span className="live-dot size-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      {children}
    </span>
  );
}

export function StatusDot({ status, size = 8 }: { status: Status; size?: number }) {
  const { color } = STATUS_META[status];
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: color, boxShadow: `0 0 ${size + 4}px ${color}` }}
    />
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel rounded-2xl ${className}`}>{children}</div>;
}
