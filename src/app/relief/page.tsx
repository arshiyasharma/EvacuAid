import type { Metadata } from "next";
import { ReliefDashboard } from "@/components/relief/ReliefDashboard";

export const metadata: Metadata = { title: "Relief fund · EvacuAid" };

export default function ReliefPage() {
  return (
    <main className="min-h-dvh bg-ink">
      <ReliefDashboard />
    </main>
  );
}
