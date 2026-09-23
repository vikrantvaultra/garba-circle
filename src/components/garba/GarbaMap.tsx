"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  LngLatBoundsLike,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Popup,
} from "maplibre-gl";
import type { GarbaEvent, GarbaKind } from "@/lib/garba/schema";
import { KIND_LABEL } from "@/lib/garba/schema";
import { directionsUrl } from "./links";
import styles from "./garba-map.module.css";

type MapLibre = typeof import("maplibre-gl");

/** OpenFreeMap: free vector tiles, no API key. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** India, for when no city is chosen yet. */
const INDIA_BOUNDS: LngLatBoundsLike = [
  [68, 7],
  [90, 31],
];

export const KIND_COLOR: Record<GarbaKind, string> = {
  ticketed: "#E0911F",
  free: "#2E9E5E",
  community: "#D6337F",
  members: "#5B6BD8",
};

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function popupHtml(event: GarbaEvent): string {
  const meta = [event.venue, event.dates, event.timings]
    .filter(Boolean)
    .map((t) => escape(t!));
  return `<p class="${styles.popKind}" style="color:${KIND_COLOR[event.kind]}">${escape(KIND_LABEL[event.kind])}</p>
    <p class="${styles.popTitle}">${escape(event.name)}</p>
    <p class="${styles.popMeta}">${meta.join("<br>")}</p>
    <a class="${styles.popLink}" href="${escape(directionsUrl(event))}" target="_blank" rel="noopener noreferrer">Directions ↗</a>`;
}

/**
 * Events at the same spot (two garbas on one farm, or two pinned to the same
 * area) would sit exactly on top of each other, so they fan out in a small
 * ring about 40 m across.
 */
function toGeoJSON(events: GarbaEvent[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const groups = new Map<string, GarbaEvent[]>();
  for (const e of events) {
    const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const group of groups.values()) {
    group.forEach((e, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      const r = group.length > 1 ? 0.0004 : 0;
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [e.lng + r * Math.cos(angle), e.lat + r * Math.sin(angle)],
        },
        properties: { id: e.id, name: e.name, kind: e.kind },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

function boundsOf(events: GarbaEvent[]): LngLatBoundsLike {
  const lngs = events.map((e) => e.lng);
  const lats = events.map((e) => e.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/**
 * The map: MapLibre GL on OpenFreeMap's "liberty" style. Pins cluster into
 * numbered circles that zoom in when tapped. With no city chosen it shows
 * every garba across India; with a city it flies there and shows only those.
 */
export function GarbaMap({
  events,
  city,
  selectedId,
  total,
  onSelect,
}: {
  events: GarbaEvent[];
  city: string | null;
  selectedId: string | null;
  /** How many there are before the kind filter, for the "x of y" chip. */
  total: number;
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const libRef = useRef<MapLibre | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // The latest data and handlers, for listeners registered once.
  const latest = useRef({ events, onSelect });
  useEffect(() => {
    latest.current = { events, onSelect };
  });

  // Create the map once. MapLibre needs WebGL and `window`, so it loads here.
  useEffect(() => {
    let cancelled = false;
    void import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !hostRef.current) return;
        // Served from public/ (see scripts/copy-maplibre-worker.mjs).
        lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        const map = new lib.Map({
          container: hostRef.current,
          style: STYLE_URL,
          bounds: latest.current.events.length ? boundsOf(latest.current.events) : INDIA_BOUNDS,
          fitBoundsOptions: { padding: 48, maxZoom: 6 },
          attributionControl: { compact: true },
          // One finger scrolls the page; two fingers (or ctrl + wheel) move
          // the map. An embedded map should never trap the page.
          cooperativeGestures: true,
          // Phones report 3x; drawing every frame at 3x is over twice the
          // pixels of 2x for a difference nobody can see on a map.
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(
          new lib.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            fitBoundsOptions: { maxZoom: 13 },
          }),
          "top-right",
        );

        map.on("error", (e) => {
          // A style that never loads leaves a blank box; say so instead.
          if (!map.isStyleLoaded() && String(e.error?.message ?? "").includes("style")) {
            setFailed(true);
          }
        });

        map.on("load", () => {
          map.addSource("garbas", {
            type: "geojson",
            data: toGeoJSON(latest.current.events),
            cluster: true,
            clusterRadius: 46,
            clusterMaxZoom: 13,
          });

          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "garbas",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#5A1E1A",
              "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 15, 25],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#FBEFD9",
            },
          });
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "garbas",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 13,
              "text-allow-overlap": true,
            },
            paint: { "text-color": "#FFFFFF" },
          });

          const kindColor = [
            "match",
            ["get", "kind"],
            "ticketed", KIND_COLOR.ticketed,
            "free", KIND_COLOR.free,
            "community", KIND_COLOR.community,
            KIND_COLOR.members,
          ] as unknown as string;

          map.addLayer({
            id: "points",
            type: "circle",
            source: "garbas",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": kindColor,
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 6, 14, 9],
              "circle-stroke-width": 2.5,
              "circle-stroke-color": "#FFFFFF",
            },
          });
          map.addLayer({
            id: "selected",
            type: "circle",
            source: "garbas",
            filter: ["==", ["get", "id"], "__none__"],
            paint: {
              "circle-color": kindColor,
              "circle-radius": 13,
              "circle-stroke-width": 4,
              "circle-stroke-color": "#FFD66B",
            },
          });
          map.addLayer({
            id: "point-labels",
            type: "symbol",
            source: "garbas",
            filter: ["!", ["has", "point_count"]],
            minzoom: 12,
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
              "text-offset": [0, 1.3],
              "text-anchor": "top",
              "text-max-width": 10,
              "text-optional": true,
            },
            paint: {
              "text-color": "#3A1410",
              "text-halo-color": "#FFFFFF",
              "text-halo-width": 1.6,
            },
          });

          // Tap a circle to zoom into it.
          map.on("click", "clusters", async (e: MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const source = map.getSource("garbas") as GeoJSONSource;
            const zoom = await source.getClusterExpansionZoom(
              feature.properties.cluster_id as number,
            );
            map.easeTo({
              center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
              zoom: zoom + 0.5,
            });
          });
          map.on("click", "points", (e: MapLayerMouseEvent) => {
            const id = e.features?.[0]?.properties.id as string | undefined;
            if (id) latest.current.onSelect(id);
          });
          for (const layer of ["clusters", "points"]) {
            map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
          }

          setReady(true);
        });

        libRef.current = lib;
        mapRef.current = map;
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // New data: redraw and bring it into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("garbas") as GeoJSONSource | undefined)?.setData(toGeoJSON(events));
    popupRef.current?.remove();

    if (events.length === 0) {
      if (!city) map.fitBounds(INDIA_BOUNDS, { padding: 24, duration: 900 });
      return;
    }
    if (!city) {
      // Every garba in the country: frame them, not the whole subcontinent.
      map.fitBounds(boundsOf(events), { padding: 48, maxZoom: 6, duration: 900 });
      return;
    }
    if (events.length === 1) {
      map.flyTo({ center: [events[0].lng, events[0].lat], zoom: 14, duration: 1200 });
    } else {
      map.fitBounds(boundsOf(events), { padding: 56, maxZoom: 14, duration: 1200 });
    }
  }, [ready, city, events]);

  // The chosen event: ring it, centre it, and open its card on the map.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    map.setFilter("selected", ["==", ["get", "id"], selectedId ?? "__none__"]);
    popupRef.current?.remove();
    const event = selectedId ? events.find((e) => e.id === selectedId) : null;
    if (!event) return;
    map.easeTo({ center: [event.lng, event.lat], zoom: Math.max(map.getZoom(), 13.5) });
    popupRef.current = new lib.Popup({
      offset: 16,
      maxWidth: "260px",
      className: styles.popup,
      focusAfterOpen: false,
    })
      .setLngLat([event.lng, event.lat])
      .setHTML(popupHtml(event))
      .addTo(map);
  }, [ready, selectedId, events]);

  const kindsHere = (Object.keys(KIND_COLOR) as GarbaKind[]).filter((k) =>
    events.some((e) => e.kind === k),
  );

  return (
    <div className={styles.frame} id="garba-map">
      <div ref={hostRef} className={styles.map} role="region" aria-label="Map of garbas" />

      <div className={styles.overlay} aria-hidden={!ready}>
        <p className={styles.chip}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" fill="currentColor" />
          </svg>
          Some pins mark the area, not the exact gate.
        </p>
        {kindsHere.length > 0 && (
          <p className={styles.chip}>
            {kindsHere.map((k) => (
              <span key={k} className={styles.legendItem}>
                <i style={{ background: KIND_COLOR[k] }} />
                {KIND_LABEL[k]}
              </span>
            ))}
            <span className={styles.legendItem}>
              <i className={styles.clusterDot}>9</i>
              Tap a circle to zoom in
            </span>
          </p>
        )}
        <p className={styles.chip}>
          <b>
            {events.length === total ? total : `${events.length} of ${total}`}{" "}
            {total === 1 ? "garba" : "garbas"}
          </b>
          {city ? ` in ${city}` : " across India"}
        </p>
      </div>

      {!ready && !failed && <p className={styles.loading}>Loading the map…</p>}
      {failed && (
        <p className={styles.loading}>
          The map couldn&rsquo;t load. The list below has every garba.
        </p>
      )}
    </div>
  );
}
