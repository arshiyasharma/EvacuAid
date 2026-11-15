"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

export type FC = GeoJSON.FeatureCollection;

type Props = {
  fire: FC;
  households: FC;
  vehicles: FC;
  routes: FC;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

const EMPTY: FC = { type: "FeatureCollection", features: [] };

const STATUS_COLOR = [
  "case",
  ["!", ["get", "alerted"]],
  "#3a3a42",
  ["==", ["get", "status"], "needs_help"],
  "#ff4d3a",
  ["==", ["get", "status"], "no_response"],
  "#ffb224",
  ["==", ["get", "status"], "leaving"],
  "#5ab0ff",
  "#3ee07f",
] as const;

export function LiveMap({ fire, households, vehicles, routes, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ fire, households, vehicles, routes });
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    latest.current = { fire, households, vehicles, routes };
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!container.current || !key) return;
    let cancelled = false;

    import("maplibre-gl").then((mod) => {
      const maplibregl = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      const el = container.current;
      if (cancelled || !el) return;

      const map = new maplibregl.Map({
        container: el,
        style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${key}`,
        center: [-118.138, 34.19],
        zoom: 12.9,
        pitch: 46,
        bearing: -12,
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      mapRef.current = map;
      if (process.env.NODE_ENV === "development") (window as unknown as { __map?: MapLibreMap }).__map = map;

      map.on("load", () => {
        map.addSource("fire", { type: "geojson", data: latest.current.fire });
        map.addSource("households", { type: "geojson", data: latest.current.households });
        map.addSource("routes", { type: "geojson", data: latest.current.routes });
        map.addSource("vehicles", { type: "geojson", data: latest.current.vehicles });

        map.addLayer({
          id: "fire-heat",
          type: "heatmap",
          source: "fire",
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "heat"], 0, 0.15, 1, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 11, 0.8, 15, 2],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 11, 26, 13, 44, 15, 90],
            "heatmap-opacity": 0.85,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,0,0)",
              0.2,
              "rgba(120,20,10,0.35)",
              0.45,
              "rgba(255,77,58,0.55)",
              0.7,
              "rgba(255,122,26,0.8)",
              1,
              "rgba(255,224,138,0.95)",
            ],
          },
        });
        map.addLayer({
          id: "fire-dots",
          type: "circle",
          source: "fire",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 1.2, 15, 3.5],
            "circle-color": ["interpolate", ["linear"], ["get", "heat"], 0, "#7a1c10", 0.5, "#ff4d3a", 1, "#ffe08a"],
            "circle-opacity": 0.9,
          },
        });

        map.addLayer({
          id: "routes",
          type: "line",
          source: "routes",
          paint: {
            "line-color": "#3ee07f",
            "line-width": 2,
            "line-opacity": 0.85,
            "line-dasharray": [2, 2],
          },
        });

        map.addLayer({
          id: "help-halo",
          type: "circle",
          source: "households",
          filter: ["all", ["get", "alerted"], ["==", ["get", "status"], "needs_help"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 8, 15, 22],
            "circle-color": "#ff4d3a",
            "circle-opacity": 0.28,
            "circle-blur": 0.8,
          },
        });
        map.addLayer({
          id: "live-ring",
          type: "circle",
          source: "households",
          filter: ["get", "live"],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 9, 15, 20],
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": 0.85,
          },
        });
        map.addLayer({
          id: "households",
          type: "circle",
          source: "households",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              11,
              ["case", ["get", "selected"], 6, 3],
              13,
              ["case", ["get", "selected"], 8, 4.2],
              15,
              ["case", ["get", "selected"], 12, 7],
            ],
            // @ts-expect-error -- MapLibre expression tuple
            "circle-color": STATUS_COLOR,
            "circle-stroke-color": ["case", ["get", "selected"], "#ffffff", "#050506"],
            "circle-stroke-width": ["case", ["get", "selected"], 2, 0.6],
          },
        });

        map.addLayer({
          id: "vehicles",
          type: "circle",
          source: "vehicles",
          paint: {
            // On a trip: bigger, solid green. At base: the usual white with a green ring.
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["case", ["get", "moving"], 6, 4], 15, ["case", ["get", "moving"], 12, 9]],
            "circle-color": ["case", ["get", "moving"], "#3ee07f", "#ffffff"],
            "circle-stroke-color": ["case", ["get", "moving"], "#ffffff", "#3ee07f"],
            "circle-stroke-width": 2.5,
          },
        });

        map.on("click", "households", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === "string") onSelectRef.current(id);
        });
        map.on("mouseenter", "households", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "households", () => (map.getCanvas().style.cursor = ""));

        ready.current = true;
        el.classList.add("opacity-100");
      });
    });

    return () => {
      cancelled = true;
      ready.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("fire") as GeoJSONSource | undefined)?.setData(fire ?? EMPTY);
    (map.getSource("households") as GeoJSONSource | undefined)?.setData(households ?? EMPTY);
  }, [fire, households, selectedId]);

  // Vehicles move every frame while a trip runs, so they update on their own.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    (map.getSource("vehicles") as GeoJSONSource | undefined)?.setData(vehicles ?? EMPTY);
    (map.getSource("routes") as GeoJSONSource | undefined)?.setData(routes ?? EMPTY);
  }, [vehicles, routes]);

  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full opacity-0 transition-opacity duration-1000" />
    </div>
  );
}
