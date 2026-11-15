// Response vehicles staged around west Altadena for the replay.
import type { Vehicle } from "../types";

export const FLEET: (Vehicle & { name: string })[] = [
  { id: "para-1", name: "Paratransit 1", kind: "paratransit", capacity: 3, wheelchair: true, location: { lng: -118.1585, lat: 34.2012 } },
  { id: "para-2", name: "Paratransit 2", kind: "paratransit", capacity: 3, wheelchair: true, location: { lng: -118.1312, lat: 34.1898 } },
  { id: "van-1", name: "Van 1", kind: "van", capacity: 8, wheelchair: false, location: { lng: -118.1503, lat: 34.1815 } },
  { id: "van-2", name: "Van 2", kind: "van", capacity: 8, wheelchair: false, location: { lng: -118.1652, lat: 34.1868 } },
  { id: "van-3", name: "Van 3", kind: "van", capacity: 8, wheelchair: false, location: { lng: -118.1418, lat: 34.2031 } },
  { id: "vol-1", name: "CERT volunteer", kind: "volunteer", capacity: 3, wheelchair: false, location: { lng: -118.1549, lat: 34.1931 } },
  { id: "para-3", name: "Paratransit 3", kind: "paratransit", capacity: 3, wheelchair: true, location: { lng: -118.1449, lat: 34.1789 } },
  { id: "van-4", name: "Van 4", kind: "van", capacity: 8, wheelchair: false, location: { lng: -118.1616, lat: 34.1957 } },
  { id: "van-5", name: "Van 5", kind: "van", capacity: 8, wheelchair: false, location: { lng: -118.1372, lat: 34.1952 } },
  { id: "vol-2", name: "CERT team 2", kind: "volunteer", capacity: 3, wheelchair: false, location: { lng: -118.1525, lat: 34.2045 } },
];

/** Where everyone is taken: Pasadena Civic Center shelter (pets welcome). */
export const SHELTER = { name: "Pasadena Civic Center", location: { lng: -118.1438, lat: 34.1436 } };
