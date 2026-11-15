import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { Embers, Spotlight, TiltCard } from "@/components/effects";
import { HeroMapCard } from "@/components/HeroMapCard";
import { SignUp } from "@/components/SignUp";
import { Logo } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="grain relative isolate min-h-dvh overflow-hidden bg-ink">
      <Spotlight />
      <Embers />
      <div className="bg-dots absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute -right-40 -top-40 -z-10 size-[820px] rounded-full bg-[radial-gradient(circle,rgb(255_122_26/0.18),transparent_65%)] blur-2xl" />
      <div className="absolute -bottom-60 -left-40 -z-10 size-[620px] rounded-full bg-[radial-gradient(circle,rgb(62_224_127/0.08),transparent_65%)] blur-2xl" />

      <header className="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-7 md:px-10">
        <Logo />
        <NavLinks />
      </header>

      <section className="mx-auto grid max-w-[1320px] items-center gap-16 px-6 pb-20 pt-8 md:px-10 lg:min-h-[calc(100dvh-96px)] lg:grid-cols-[1.05fr_1fr] lg:pt-0">
        <div>
          <h1 className="rise text-[clamp(60px,8.4vw,128px)] font-medium leading-[0.92] tracking-[-0.05em]">
            Out safe.
            <br />
            <em className="shimmer pr-2 font-medium italic tracking-[-0.055em]">Aid tonight.</em>
          </h1>
          <p
            className="rise mt-8 max-w-[500px] text-[21px] leading-[1.5] text-muted"
            style={{ animationDelay: "120ms" }}
          >
            When the evacuation alert goes out, EvacuAid finds who can&apos;t leave, gets them out first, and gets them fraud-checked aid the same night.
          </p>
          <div className="rise mt-10" style={{ animationDelay: "220ms" }}>
            <Link
              href="/console"
              className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-full bg-fg px-7 py-3.5 text-[18px] font-medium text-ink shadow-[0_0_40px_-8px_rgba(255,255,255,0.45)] transition hover:bg-white hover:shadow-[0_0_60px_-6px_rgba(255,255,255,0.6)]"
            >
              Open the console
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <a
              href="#signup"
              className="ml-3 inline-flex items-center rounded-full border border-line-strong px-6 py-3.5 text-[18px] text-fg transition hover:bg-white/[0.06]"
            >
              Sign up for alerts
            </a>
          </div>
          <p
            className="rise mt-20 max-w-[440px] border-l border-help/60 pl-4 font-mono text-[15.5px] leading-relaxed text-muted"
            style={{ animationDelay: "320ms" }}
          >
            Eaton fire, Jan 2025. 18 of the 19 deaths were in west Altadena, where the evacuation order came last.
          </p>
        </div>

        <div className="rise flex justify-center lg:justify-end" style={{ animationDelay: "160ms" }}>
          <TiltCard className="w-full max-w-[580px]">
            <HeroMapCard />
          </TiltCard>
        </div>
      </section>

      <SignUp number={process.env.PHOTON_AGENT_HANDLE ?? null} />
    </main>
  );
}
