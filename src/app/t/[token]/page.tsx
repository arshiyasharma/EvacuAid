import type { Metadata } from "next";
import { TrackPage } from "@/components/track/TrackPage";

export const metadata: Metadata = {
  title: "Your ride · EvacuAid",
  description: "Live status of your evacuation ride.",
  robots: { index: false, follow: false },
};

export default async function Track({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  return (
    <main className="min-h-dvh bg-ink">
      <TrackPage token={token} />
    </main>
  );
}
