/**
 * The garba map's data: public Navratri events gathered from organisers,
 * ticketing pages and news coverage (see each event's `sources`), and
 * validated on import by scripts/garba-import.ts.
 */

import raw from "./events.json";
import { GarbaEventSchema, type GarbaCity, type GarbaEvent } from "./schema";

// Parsed once at startup; a malformed file fails loudly instead of plotting
// nonsense on the map.
export const GARBA_EVENTS: GarbaEvent[] = GarbaEventSchema.array().parse(raw);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Every city with at least one event, busiest first. */
export function garbaCities(): GarbaCity[] {
  const byCity = new Map<string, GarbaEvent[]>();
  for (const event of GARBA_EVENTS) {
    const list = byCity.get(event.city) ?? [];
    list.push(event);
    byCity.set(event.city, list);
  }
  return [...byCity.entries()]
    .map(([name, events]) => ({
      name,
      count: events.length,
      lat: median(events.map((e) => e.lat)),
      lng: median(events.map((e) => e.lng)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** The most recent date any event was checked against its sources. */
export function lastChecked(): string | null {
  return GARBA_EVENTS.reduce<string | null>(
    (latest, e) => (!latest || e.lastChecked > latest ? e.lastChecked : latest),
    null,
  );
}
