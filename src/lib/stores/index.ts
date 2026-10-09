/**
 * Every Havmor outlet from havmor.com/store-locator, imported and checked by
 * scripts/havmor-stores-import.ts. The map loads stores.json itself, in its
 * own lazily loaded chunk; this module is the server's validated copy.
 */

import raw from "./stores.json";
import { HavmorStoreFileSchema, type HavmorStore, type NearbyStore } from "./schema";

// Parsed once at startup, like the garba events: a malformed file fails
// loudly instead of plotting nonsense on the map.
const file = HavmorStoreFileSchema.parse(raw);

export const HAVMOR_STORES: HavmorStore[] = file.stores;
export const STORES_FETCHED_ON = file.fetchedOn;

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * The closest store to a point, if one is within `maxKm`. Stores placed by
 * area rather than by Havmor's own pin are skipped: "1.2 km away" should
 * mean it.
 */
export function nearestStore(
  point: { lat: number; lng: number },
  maxKm = 8,
): NearbyStore | null {
  let best: NearbyStore | null = null;
  for (const s of HAVMOR_STORES) {
    if (s.coordsNote) continue;
    const d = km(point, s);
    if (d <= maxKm && (!best || d < best.km)) {
      best = { id: s.id, name: s.name, address: s.address, lat: s.lat, lng: s.lng, km: d };
    }
  }
  return best;
}
