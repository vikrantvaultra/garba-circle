/**
 * Merge researched garba events into src/lib/garba/events.json.
 *
 *   npx tsx scripts/garba-import.ts <file.json> [more.json ...]
 *
 * Each input is a JSON array in the GarbaEventSchema shape. The import
 * validates every event, rejects duplicates, and refuses pins that sit
 * implausibly far from the rest of their city (a geocoder that matched a
 * same-named place in another state is the usual cause).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GarbaEventSchema, type GarbaEvent } from "../src/lib/garba/schema";

const OUT = join(__dirname, "../src/lib/garba/events.json");
/** Farther than this from the city's median pin and the pin is suspect. */
const MAX_KM_FROM_CITY = 45;

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: tsx scripts/garba-import.ts <file.json> ...");
  process.exit(1);
}

const accepted: GarbaEvent[] = [];
const problems: string[] = [];
const ids = new Set<string>();

for (const file of files) {
  const rows = JSON.parse(readFileSync(file, "utf8")) as unknown[];
  rows.forEach((row, i) => {
    const parsed = GarbaEventSchema.safeParse(row);
    if (!parsed.success) {
      const name = (row as { name?: string })?.name ?? `#${i}`;
      problems.push(`${file}: ${name}: ${parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
      return;
    }
    const event = { ...parsed.data, artists: parsed.data.artists.filter(Boolean) };
    if (ids.has(event.id)) {
      problems.push(`${file}: duplicate id ${event.id}`);
      return;
    }
    ids.add(event.id);
    accepted.push(event);
  });
}

// Outlier pins, city by city.
const byCity = new Map<string, GarbaEvent[]>();
for (const e of accepted) byCity.set(e.city, [...(byCity.get(e.city) ?? []), e]);
const keep: GarbaEvent[] = [];
for (const [city, events] of byCity) {
  const centre = { lat: median(events.map((e) => e.lat)), lng: median(events.map((e) => e.lng)) };
  for (const e of events) {
    const d = km(centre, e);
    if (events.length >= 3 && d > MAX_KM_FROM_CITY) {
      problems.push(`${city}: ${e.name} is ${d.toFixed(0)} km from the city's other pins; dropped`);
      continue;
    }
    keep.push(e);
  }
}

keep.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
writeFileSync(OUT, JSON.stringify(keep, null, 2) + "\n");

const cities = [...new Set(keep.map((e) => e.city))];
console.log(`Wrote ${keep.length} events in ${cities.length} cities to ${OUT}`);
for (const city of cities) {
  const list = keep.filter((e) => e.city === city);
  const confirmed = list.filter((e) => e.status === "confirmed-2026").length;
  console.log(`  ${city.padEnd(12)} ${String(list.length).padStart(3)}  (${confirmed} confirmed for 2026)`);
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log("  - " + p);
}
