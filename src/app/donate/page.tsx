import type { Metadata } from "next";
import { DonatePage } from "@/components/donate/DonatePage";

export const metadata: Metadata = { title: "Donate · EvacuAid" };

export default function Donate() {
  return (
    <main className="min-h-dvh bg-ink">
      <DonatePage />
    </main>
  );
}
