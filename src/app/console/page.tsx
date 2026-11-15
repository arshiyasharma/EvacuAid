import type { Metadata } from "next";
import { ConsoleApp } from "@/components/console/ConsoleApp";

export const metadata: Metadata = { title: "Console · EvacuAid" };

export default function ConsolePage() {
  return (
    <main className="grid h-dvh grid-rows-[64px_1fr_92px] overflow-hidden bg-ink">
      <ConsoleApp />
    </main>
  );
}
