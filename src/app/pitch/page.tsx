import type { Metadata } from "next";
import { PitchPage } from "@/components/pitch/PitchPage";
import { counterfactual } from "@/lib/replay/counterfactual";
import { clockLabel, FIRE, REPLAY_END } from "@/lib/replay/eaton";
import { householdsAt } from "@/lib/replay/households";

export const metadata: Metadata = { title: "Pitch · EvacuAid" };

const STORIES = [
  { key: "ride_wheelchair", title: "Wheelchair, no car", tag: "Ride · operator dispatches" },
  { key: "ride_oxygen_es", title: "Abuela con oxígeno", tag: "Español · medical" },
  { key: "aid_gas", title: "Can't afford gas", tag: "Aid sized to $150" },
  { key: "money_no_car", title: "Asks for money, needs a ride", tag: "Smart triage" },
  { key: "neighbor", title: "Neighbor left behind", tag: "Nobody left" },
  { key: "silent", title: "Never answers", tag: "Two texts, then a door knock" },
  { key: "ride_blocked", title: "Road blocked by fire", tag: "Emergency · 911 + vehicle" },
  { key: "scam_check", title: "“Is this a scam?”", tag: "Trust" },
];

export default function Pitch() {
  // Whole conversations from the replay, handled end to end by another sector's operator.
  const end = householdsAt(REPLAY_END);
  const stories = STORIES.map((s) => {
    const h = end.find((x) => x.story === s.key && x.sector === "other") ?? end.find((x) => x.story === s.key);
    return { ...s, address: h?.address ?? "", messages: (h?.messages ?? []).map((m) => ({ from: m.from, text: m.text, at: clockLabel(m.at) })) };
  }).filter((s) => s.messages.length);

  // The real detections, scaled into a square, timed 0..1 by when satellites saw them.
  const lng = FIRE.points.map((p) => p.lng);
  const lat = FIRE.points.map((p) => p.lat);
  const seen = FIRE.points.map((p) => p.seen);
  const [x0, x1, y0, y1, t0, t1] = [Math.min(...lng), Math.max(...lng), Math.min(...lat), Math.max(...lat), Math.min(...seen), Math.max(...seen)];
  const span = Math.max(x1 - x0, y1 - y0);
  const points = FIRE.points.map((p) => ({
    x: 8 + ((p.lng - x0) / span) * 84,
    y: 92 - ((p.lat - y0) / span) * 84,
    t: (p.seen - t0) / Math.max(1, t1 - t0),
  }));

  return <PitchPage stories={stories} cf={counterfactual(200)} points={points} />;
}
