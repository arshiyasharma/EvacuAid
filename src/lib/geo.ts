import type { LngLat } from "./types";

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** Distance from a point to the nearest point in a list (km). */
export function nearestKm(p: LngLat, points: LngLat[]): number {
  let best = Infinity;
  for (const q of points) best = Math.min(best, haversineKm(p, q));
  return best;
}

/** Ray-casting point-in-polygon (polygon as a ring of points). */
export function inPolygon(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const crosses =
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}
