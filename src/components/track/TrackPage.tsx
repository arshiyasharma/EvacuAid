"use client";

// "Track your ride": the page a resident opens from the dispatch text.
// The van's position is estimated from the trip plan and moves in step with the texts.

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";

type LngLat = { lng: number; lat: number };
type Trip = {
  vehicleName: string;
  step: "coming" | "outside" | "onboard" | "safe" | "ended";
  language: "en" | "es";
  now: number;
  dispatchedAt: number;
  arriveAt: number;
  boardAt: number;
  shelterAt: number;
  etaMin: number;
  toShelterMin: number;
  van: LngLat;
  home: LngLat;
  shelter: LngLat;
  shelterName: string;
};

const TEXT = {
  en: {
    title: "Your ride",
    steps: ["On the way", "Outside", "On board", "Safe"],
    coming: (m: number) => (m <= 1 ? "Arriving in about a minute" : `Arriving in about ${m} min`),
    outside: "Outside your home now",
    onboard: (m: number) => (m <= 1 ? "About a minute to the shelter" : `About ${m} min to the shelter`),
    safe: "You're checked in. We're glad you're safe.",
    ended: "This trip has ended.",
    shelter: "Shelter",
    estimated: "Van position is estimated from the trip plan.",
    danger: "In danger right now? Call 911.",
    gone: "This link has ended",
    goneBody: "A new trip or a new drill replaced it. Your latest text has the current link.",
    loading: "Finding your ride…",
  },
  es: {
    title: "Su transporte",
    steps: ["En camino", "Afuera", "A bordo", "A salvo"],
    coming: (m: number) => (m <= 1 ? "Llega en un minuto" : `Llega en unos ${m} min`),
    outside: "Está afuera de su casa",
    onboard: (m: number) => (m <= 1 ? "Un minuto al refugio" : `Unos ${m} min al refugio`),
    safe: "Está registrado. Nos alegra que esté a salvo.",
    ended: "Este viaje terminó.",
    shelter: "Refugio",
    estimated: "La posición del vehículo es estimada según el plan del viaje.",
    danger: "¿En peligro ahora? Llame al 911.",
    gone: "Este enlace terminó",
    goneBody: "Un viaje o simulacro nuevo lo reemplazó. Su último mensaje tiene el enlace actual.",
    loading: "Buscando su transporte…",
  },
};

const lerp = (a: LngLat, b: LngLat, f: number): LngLat => {
  const k = Math.min(1, Math.max(0, f));
  return { lng: a.lng + (b.lng - a.lng) * k, lat: a.lat + (b.lat - a.lat) * k };
};

/** Where the van is at time `t` (server clock), from the trip plan. */
function vanAt(trip: Trip, t: number): LngLat {
  if (trip.step === "safe" || trip.step === "ended") return trip.shelter;
  if (trip.step === "onboard" || t >= trip.boardAt) {
    return lerp(trip.home, trip.shelter, (t - trip.boardAt) / Math.max(1, trip.shelterAt - trip.boardAt));
  }
  if (t >= trip.arriveAt) return trip.home;
  return lerp(trip.van, trip.home, (t - trip.dispatchedAt) / Math.max(1, trip.arriveAt - trip.dispatchedAt));
}

function markerEl(label: string, color: string) {
  const el = document.createElement("div");
  el.style.cssText = `display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:#0b0b0d;border:2px solid ${color};box-shadow:0 0 18px ${color};font-size:17px`;
  el.textContent = label;
  return el;
}

export function TrackPage({ token }: { token: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [gone, setGone] = useState(false);
  const [offset, setOffset] = useState(0); // server clock − browser clock
  const [clock, setClock] = useState(() => Date.now());
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const van = useRef<Marker | null>(null);
  const tripRef = useRef<Trip | null>(null);

  // Poll the trip every 3 s.
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/track/${encodeURIComponent(token)}`, { cache: "no-store" });
        if (stop) return;
        if (r.status === 404) {
          setGone(true);
          return;
        }
        if (!r.ok) return;
        const t = (await r.json()) as Trip;
        if (stop) return;
        tripRef.current = t;
        setOffset(t.now - Date.now());
        setTrip(t);
        setGone(false);
      } catch {
        // offline for a moment: keep the last state
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [token]);

  // Smooth van movement and countdown between polls.
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Build the map once the first trip arrives.
  const ready = Boolean(trip);
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const t = tripRef.current;
    if (!ready || !t || !container.current || !key || map.current) return;
    let cancelled = false;
    import("maplibre-gl").then((mod) => {
      const maplibregl = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (cancelled || !container.current) return;
      const m = new maplibregl.Map({
        container: container.current,
        style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`,
        center: [t.home.lng, t.home.lat],
        zoom: 12,
        attributionControl: { compact: true },
      });
      map.current = m;
      m.on("load", () => {
        m.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [t.van, t.home, t.shelter].map((p) => [p.lng, p.lat]) },
          },
        });
        m.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#3ee07f", "line-width": 3, "line-opacity": 0.7, "line-dasharray": [2, 2] } });
        new maplibregl.Marker({ element: markerEl("🏠", "#ff4d3a") }).setLngLat([t.home.lng, t.home.lat]).addTo(m);
        new maplibregl.Marker({ element: markerEl("🏛", "#3ee07f") }).setLngLat([t.shelter.lng, t.shelter.lat]).addTo(m);
        const p = vanAt(t, Date.now() + (t.now - Date.now()));
        van.current = new maplibregl.Marker({ element: markerEl("🚐", "#ffb224") }).setLngLat([p.lng, p.lat]).addTo(m);
        const b = new maplibregl.LngLatBounds();
        [t.van, t.home, t.shelter].forEach((q) => b.extend([q.lng, q.lat]));
        m.fitBounds(b, { padding: 56, duration: 0 });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  // Move the van marker.
  useEffect(() => {
    if (!trip || !van.current) return;
    const p = vanAt(trip, clock + offset);
    van.current.setLngLat([p.lng, p.lat]);
  }, [trip, offset, clock]);

  const L = TEXT[trip?.language ?? "en"];

  if (gone) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-6 text-center">
        <div className="text-[28px] font-medium">{L.gone}</div>
        <p className="mt-3 text-[17px] text-muted">{L.goneBody}</p>
        <p className="mt-8 text-[15px] text-help">{L.danger}</p>
      </div>
    );
  }
  if (!trip) {
    return <div className="grid min-h-dvh place-items-center text-[17px] text-muted">{L.loading}</div>;
  }

  const now = clock + offset;
  // Count down from the minutes the texts quoted, at the pace the trip actually runs.
  const mins = (quoted: number, start: number, end: number) => Math.max(1, Math.ceil((quoted * (end - now)) / Math.max(1, end - start)));
  const stepIndex = { coming: 0, outside: 1, onboard: 2, safe: 3, ended: 3 }[trip.step];
  const status =
    trip.step === "coming"
      ? L.coming(mins(trip.etaMin, trip.dispatchedAt, trip.arriveAt))
      : trip.step === "outside"
        ? L.outside
        : trip.step === "onboard"
          ? L.onboard(mins(trip.toShelterMin, trip.boardAt, trip.shelterAt))
          : trip.step === "safe"
            ? L.safe
            : L.ended;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col px-4 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-medium">
          <span className="size-2.5 rounded-full bg-out shadow-[0_0_10px_var(--color-out)]" />
          EvacuAid
        </div>
        <span className="text-[14px] text-muted">{L.title}</span>
      </div>

      <div ref={container} className="mt-4 h-[44vh] min-h-[260px] overflow-hidden rounded-3xl border border-line bg-surface" />

      <div className="mt-5">
        <div className="text-[15px] text-muted">{trip.vehicleName}</div>
        <div className={`mt-1 text-[28px] font-medium leading-tight ${trip.step === "safe" ? "text-out" : ""}`}>{status}</div>
      </div>

      <ol className="mt-5 grid grid-cols-4 gap-2">
        {L.steps.map((s, i) => (
          <li key={s}>
            <div className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-out" : "bg-white/10"}`} />
            <div className={`mt-2 text-[13.5px] ${i <= stepIndex ? "text-fg" : "text-faint"}`}>{s}</div>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl border border-line bg-raised/60 p-4 text-[15.5px]">
        <span className="text-muted">{L.shelter}: </span>
        {trip.shelterName}
      </div>

      <p className="mt-auto pt-6 text-[13px] text-faint">{L.estimated}</p>
      <p className="mt-1 text-[15px] text-help">{L.danger}</p>
    </div>
  );
}
