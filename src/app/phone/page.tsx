import type { Metadata } from "next";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { PhoneSim } from "@/components/PhoneSim";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Phone · EvacuAid" };

export default function PhonePage() {
  return (
    <main className="grain relative isolate grid min-h-dvh grid-rows-[64px_1fr] overflow-hidden bg-ink">
      <header className="flex items-center justify-between border-b border-line px-6">
        <div className="flex items-center gap-5">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <span className="h-4 w-px bg-line-strong" />
          <NavLinks />
        </div>
      </header>
      <div className="bg-dots absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute left-1/2 top-1/2 -z-10 size-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_122_26/0.12),transparent_65%)] blur-2xl" />
      <div className="grid place-items-center p-6">
        <PhoneSim />
      </div>
    </main>
  );
}
