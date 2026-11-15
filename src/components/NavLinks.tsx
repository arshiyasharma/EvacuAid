"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const PAGES = [
  { href: "/pitch", label: "Pitch" },
  { href: "/console", label: "Console" },
  { href: "/phone", label: "Phone" },
  { href: "/relief", label: "Relief fund" },
  { href: "/donate", label: "Donate" },
];

/** The same links on every page; the current one is lit. */
export function NavLinks({ className = "" }: { className?: string }) {
  const path = usePathname();
  return (
    <nav className={`flex items-center gap-1 ${className}`}>
      {PAGES.map((p) => {
        const on = path === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[16px] transition ${
              on ? "bg-white/[0.1] text-fg" : "text-muted hover:bg-white/[0.05] hover:text-fg"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
