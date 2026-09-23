"use client";

/**
 * The city and gender chosen on the spin screen, kept for the browser
 * session. "Spin again" from a chat goes back to /spin, and nobody should
 * have to pick the same city twice in one evening. A fresh session asks
 * again, and nothing here ever leaves the device.
 */

import type { GenderChoice } from "@/components/circle/CityPicker";

const KEY = "gc_spin_prefs_v1";
const EVENT = "gc-spin-prefs";

export type SpinPrefs = { city: string | null; gender: GenderChoice | null };

const EMPTY = "{}";

export function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** The raw string, so useSyncExternalStore sees a stable value between changes. */
export function getSnapshot(): string {
  try {
    return sessionStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return memory;
  }
}

export function getServerSnapshot(): string {
  return EMPTY;
}

// Used when sessionStorage is unavailable (some private modes).
let memory = EMPTY;

export function parse(raw: string): SpinPrefs {
  try {
    const value = JSON.parse(raw) as Partial<SpinPrefs>;
    const gender =
      value.gender === "female" || value.gender === "male" || value.gender === "both"
        ? value.gender
        : null;
    const city = typeof value.city === "string" && value.city.trim() ? value.city : null;
    return { city, gender };
  } catch {
    return { city: null, gender: null };
  }
}

export function save(prefs: SpinPrefs) {
  const raw = JSON.stringify(prefs);
  memory = raw;
  try {
    sessionStorage.setItem(KEY, raw);
  } catch {
    /* kept in memory for this page instead */
  }
  window.dispatchEvent(new Event(EVENT));
}
