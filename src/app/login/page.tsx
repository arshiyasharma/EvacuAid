import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/ui";
import { isOperator } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Operator sign in · EvacuAid" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only same-site paths, never an outside URL.
  const to = next && next.startsWith("/") && !next.startsWith("//") ? next : "/console";
  if (await isOperator()) redirect(to);
  return (
    <main className="grain relative isolate grid min-h-dvh place-items-center bg-ink px-4">
      <div className="bg-dots absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="w-full max-w-[420px]">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <h1 className="mt-10 text-[40px] font-medium leading-tight tracking-[-0.03em]">Operator sign in</h1>
        <p className="mt-2 text-[17px] text-muted">
          For the emergency operations team. The public can watch the console; only operators can send alerts, see residents, or move money.
        </p>
        <LoginForm next={to} />
      </div>
    </main>
  );
}
