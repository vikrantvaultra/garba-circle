"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ExpressionSpecification,
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

/** India, for when there's nothing to frame. */
const INDIA_BOUNDS: LngLatBoundsLike = [
  [68, 7],
  [90, 31],
];

const BRAND_RED = "#D3002B";
const CHOCO = "#3B1D15";

/** Flavour colours: caramel, pista, strawberry, blueberry. */
export const KIND_COLOR: Record<GarbaKind, string> = {
  ticketed: "#D9861A",
  free: "#4E9A3A",
  community: "#E0457B",
  members: "#5B4FCF",
};

/**
 * The mark the map is built from: crossed dandiya on red. The same image
 * draws the card's swatch, the map's pins and its cluster badges, so the key
 * and the map always match.
 */
const MARK_SRC = "/brand/map/garba.webp";

function MarkIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 9 KB webp in public/
    <img src={MARK_SRC} alt="" className={className} width={28} height={28} draggable={false} />
  );
}

function loadMark(): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = MARK_SRC;
  return img.decode().then(() => img);
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function garbaPopupHtml(event: GarbaEvent): string {
  const meta = [event.venue, event.dates, event.timings]
    .filter(Boolean)
    .map((t) => escape(t!));
  return `<p class="${styles.popKind}" style="color:${KIND_COLOR[event.kind]}">Garba · ${escape(KIND_LABEL[event.kind])}</p>
    <p class="${styles.popTitle}">${escape(event.name)}</p>
    <p class="${styles.popMeta}">${meta.join("<br>")}</p>
    <div class="${styles.popActions}">
      <a class="${styles.popLink}" href="${escape(directionsUrl(event))}" target="_blank" rel="noopener noreferrer">Directions ↗</a>
    </div>`;
}

type Place = { id: string; kind: string; name: string; lat: number; lng: number };

/**
 * Garbas at the same spot (two on one farm) would sit exactly on top of
 * each other, so they fan out in a small ring: every one stays tappable.
 */
function toGeoJSON(places: Place[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const groups = new Map<string, Place[]>();
  for (const p of places) {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const group of groups.values()) {
    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      const r = group.length > 1 ? 0.0004 * Math.sqrt(group.length) : 0;
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [p.lng + r * Math.cos(angle), p.lat + r * Math.sin(angle)],
        },
        properties: { id: p.id, kind: p.kind, name: p.name },
      });
    });
  }
  return { type: "FeatureCollection", features };
}

function boundsOf(points: { lat: number; lng: number }[]): [[number, number], [number, number]] {
  const lngs = points.map((e) => e.lng);
  const lats = points.map((e) => e.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

/* ---------- Badges, drawn once per look and handed to MapLibre ---------- */

function canvas(width: number, height: number, ratio: number): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = Math.ceil(width * ratio);
  c.height = Math.ceil(height * ratio);
  const ctx = c.getContext("2d")!;
  ctx.scale(ratio, ratio);
  return ctx;
}

function drawMark(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, size: number) {
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
}

/** A cluster: a red pill with the garba mark and how many garbas are here. */
function clusterBadge(garbas: number, ratio: number, font: string, mark: HTMLImageElement): ImageData {
  const H = 32;
  const PAD = 4;
  const ICON = 24;
  const GAP = 4;
  const M = 6; // room for the shadow
  const measure = canvas(1, 1, 1);
  measure.font = `800 13.5px ${font}`;
  const W = Math.max(PAD + ICON + GAP + measure.measureText(String(garbas)).width + 10, H);
  const ctx = canvas(W + M * 2, H + M * 2, ratio);
  ctx.font = measure.font;
  ctx.textBaseline = "middle";

  // White rim and shadow.
  ctx.save();
  ctx.shadowColor = "rgba(59, 29, 21, 0.32)";
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(M, M, W, H, H / 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(M + 2, M + 2, W - 4, H - 4, (H - 4) / 2);
  ctx.fillStyle = BRAND_RED;
  ctx.fill();

  const cy = M + H / 2;
  const x = M + PAD;
  drawMark(ctx, mark, x + ICON / 2, cy, ICON);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(String(garbas), x + ICON + GAP, cy + 0.5);
  return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/**
 * A single place: a map pin whose head is the place's mark, as in the layer
 * card, on a white body (gold for the chosen garba). A garba's pin carries a
 * dot in its kind's colour, keyed along the bottom of the map.
 */
function pin(ratio: number, mark: HTMLImageElement, { rim, dot }: { rim: string; dot?: string }): ImageData {
  const W = 38;
  const H = 46;
  const ctx = canvas(W, H, ratio);
  const cx = W / 2;
  const r = 14;
  const cy = r + 4;
  const tip = H - 3;
  ctx.save();
  ctx.shadowColor = "rgba(59, 29, 21, 0.38)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.moveTo(cx, tip);
  ctx.bezierCurveTo(cx - 3, tip - 6, cx - r, cy + 8, cx - r, cy);
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.bezierCurveTo(cx + r, cy + 8, cx + 3, tip - 6, cx, tip);
  ctx.closePath();
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.restore();
  drawMark(ctx, mark, cx, cy, (r - 2.25) * 2);
  if (dot) {
    ctx.beginPath();
    ctx.arc(cx + 11, cy - 10, 4.75, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function pinFor(id: string, ratio: number, mark: HTMLImageElement): ImageData | null {
  const [prefix, kind] = id.split(":");
  const dot = KIND_COLOR[kind as GarbaKind];
  if (!dot || (prefix !== GARBA_PIN && prefix !== GARBA_PIN_ON)) return null;
  return pin(ratio, mark, { rim: prefix === GARBA_PIN_ON ? "#FFB81C" : "#FFFFFF", dot });
}

/**
 * Where a popup sits for each side MapLibre may open it on: clear of a pin
 * `height` px tall standing on its point, never on top of it.
 */
function besidePin(height: number): Record<"center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right", [number, number]> {
  const mid = -height / 2;
  return {
    center: [0, mid],
    top: [0, 6],
    bottom: [0, -height - 4],
    left: [18, mid],
    right: [-18, mid],
    "top-left": [12, 4],
    "top-right": [-12, 4],
    "bottom-left": [12, -height],
    "bottom-right": [-12, -height],
  };
}

const CLUSTER_PREFIX = "gc-cluster:";
const GARBA_PIN = "gc-garba";
const GARBA_PIN_ON = "gc-garba-on";

/**
 * The map: MapLibre GL on OpenFreeMap's "liberty" style, with every garba
 * in India. Nearby garbas cluster into badges that count them and zoom in
 * when tapped. With no city chosen it frames the country; with a city it
 * flies to that city's garbas.
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
  /** How many garbas there are before the kind filter, for "x of y". */
  total: number;
  onSelect: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const libRef = useRef<MapLibre | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const places = useMemo<Place[]>(
    () => events.map((e) => ({ id: e.id, kind: e.kind, name: e.name, lat: e.lat, lng: e.lng })),
    [events],
  );

  // The latest data and handlers, for listeners registered once.
  const latest = useRef({ places, onSelect });
  useEffect(() => {
    latest.current = { places, onSelect };
  });

  // Create the map once. MapLibre needs WebGL and `window`, so it loads here.
  useEffect(() => {
    let cancelled = false;
    void import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !hostRef.current) return;
        // Served from public/ (see scripts/copy-maplibre-worker.mjs).
        lib.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        // Phones report 3x; drawing every frame at 3x is over twice the
        // pixels of 2x for a difference nobody can see on a map.
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const map = new lib.Map({
          container: hostRef.current,
          style: STYLE_URL,
          bounds: INDIA_BOUNDS,
          fitBoundsOptions: { padding: 24 },
          attributionControl: { compact: true },
          // One finger scrolls the page; two fingers (or ctrl + wheel) move
          // the map. An embedded map should never trap the page.
          cooperativeGestures: true,
          pixelRatio: ratio,
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(
          new lib.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            fitBoundsOptions: { maxZoom: 13 },
          }),
          "top-right",
        );

        // Badges are drawn on demand, one image per count,
        // in the app's own font once it has loaded. (MapLibre 6 takes images
        // from this resolver; a styleimagemissing listener is too late.)
        const font = getComputedStyle(hostRef.current).fontFamily || "sans-serif";
        const mark = loadMark();
        map.setMissingStyleImageResolver(async (id) => {
          if (!id.startsWith("gc-")) return;
          const loaded = await mark.catch(() => null);
          if (!loaded) return;
          if (id.startsWith(CLUSTER_PREFIX)) {
            await document.fonts.load(`800 13.5px ${font}`).catch(() => undefined);
            if (map.hasImage(id)) return;
            const count = Number(id.slice(CLUSTER_PREFIX.length));
            map.addImage(id, clusterBadge(count, ratio, font, loaded), { pixelRatio: ratio });
            return;
          }
          const image = pinFor(id, ratio, loaded);
          if (image && !map.hasImage(id)) map.addImage(id, image, { pixelRatio: ratio });
        });

        map.on("error", (e) => {
          // A style that never loads leaves a blank box; say so instead.
          if (!map.isStyleLoaded() && String(e.error?.message ?? "").includes("style")) {
            setFailed(true);
          }
        });

        map.on("load", () => {
          map.addSource("places", {
            type: "geojson",
            data: toGeoJSON(latest.current.places),
            cluster: true,
            clusterRadius: 60,
            clusterMaxZoom: 13,
          });

          const single: ExpressionSpecification = ["!", ["has", "point_count"]];
          map.addLayer({
            id: "points",
            type: "symbol",
            source: "places",
            filter: single,
            layout: {
              "icon-image": ["concat", GARBA_PIN, ":", ["get", "kind"]],
              "icon-anchor": "bottom",
              "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.85, 14, 1.05],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          });
          map.addLayer({
            id: "selected",
            type: "symbol",
            source: "places",
            filter: ["==", ["get", "id"], "__none__"],
            layout: {
              "icon-image": ["concat", GARBA_PIN_ON, ":", ["get", "kind"]],
              "icon-anchor": "bottom",
              "icon-size": 1.3,
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
            },
          });
          map.addLayer({
            id: "point-labels",
            type: "symbol",
            source: "places",
            filter: single,
            minzoom: 12,
            layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 12,
              "text-offset": [0, 0.35],
              "text-anchor": "top",
              "text-max-width": 10,
              "text-optional": true,
            },
            paint: {
              "text-color": CHOCO,
              "text-halo-color": "#FFFFFF",
              "text-halo-width": 1.6,
            },
          });
          map.addLayer({
            id: "clusters",
            type: "symbol",
            source: "places",
            filter: ["has", "point_count"],
            layout: {
              "icon-image": ["concat", CLUSTER_PREFIX, ["to-string", ["get", "point_count"]]],
              "icon-allow-overlap": true,
              "icon-ignore-placement": true,
              // Bigger areas draw over the smaller ones beside them.
              "symbol-sort-key": ["get", "point_count"],
            },
          });

          // Tap a badge to zoom into it.
          map.on("click", "clusters", async (e: MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const source = map.getSource("places") as GeoJSONSource;
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

  // What's on the map changed (a city or a filter): redraw.
  useEffect(() => {
    if (!ready) return;
    (mapRef.current?.getSource("places") as GeoJSONSource | undefined)?.setData(toGeoJSON(places));
  }, [ready, places]);

  // A new city or filter: bring it into view.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    popupRef.current?.remove();

    if (!city) {
      // The whole country: frame every garba, not the ocean.
      map.fitBounds(events.length ? boundsOf(events) : INDIA_BOUNDS, { padding: 36, maxZoom: 6, duration: 900 });
      return;
    }
    if (events.length === 1) {
      map.flyTo({ center: [events[0].lng, events[0].lat], zoom: 14, duration: 1200 });
    } else if (events.length > 1) {
      map.fitBounds(boundsOf(events), { padding: 56, maxZoom: 14, duration: 1200 });
    }
  }, [ready, city, events]);

  // The chosen garba: ring it, centre it, and open its card on the map.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    map.setFilter("selected", [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "id"], selectedId ?? "__none__"],
    ]);
    popupRef.current?.remove();
    const event = selectedId ? events.find((e) => e.id === selectedId) : null;
    if (!event) return;
    map.easeTo({ center: [event.lng, event.lat], zoom: Math.max(map.getZoom(), 13.5) });
    popupRef.current = new lib.Popup({
      offset: besidePin(56),
      maxWidth: "270px",
      className: styles.popup,
      focusAfterOpen: false,
    })
      .setLngLat([event.lng, event.lat])
      .setHTML(garbaPopupHtml(event))
      .addTo(map);
  }, [ready, selectedId, events]);

  const kindsHere = (Object.keys(KIND_COLOR) as GarbaKind[]).filter((k) =>
    events.some((e) => e.kind === k),
  );
  const garbaCount = events.length === total ? `${total}` : `${events.length} of ${total}`;

  return (
    <div className={styles.frame} id="garba-map">
      <div ref={hostRef} className={styles.map} role="region" aria-label="Map of garbas" />

      <div className={styles.panel}>
        <p className={styles.scope}>{city ? `In and around ${city}` : "Across India"}</p>
        <p className={styles.count}>
          <span className={styles.swatch}>
            <MarkIcon />
          </span>
          <span>
            <b>{garbaCount}</b> {total === 1 ? "garba" : "garbas"}
          </span>
        </p>
      </div>

      {kindsHere.length > 0 && (
        <p className={styles.legend}>
          {kindsHere.map((k) => (
            <span key={k} className={styles.legendItem}>
              <i style={{ background: KIND_COLOR[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
          <span className={styles.legendHint}>Some pins mark the area, not the exact gate.</span>
        </p>
      )}

      {!ready && !failed && <p className={styles.loading}>Loading the map…</p>}
      {failed && (
        <p className={styles.loading}>
          The map couldn&rsquo;t load. The list below has every garba.
        </p>
      )}
    </div>
  );
}
