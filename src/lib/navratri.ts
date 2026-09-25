/**
 * Where we are in the festival. A garba night runs well past midnight, so a
 * "night" here starts at 6 am IST and runs to 6 am the next morning — a spin
 * at 1 am still belongs to the night before.
 */

/** Sharad Navratri 2026: Ghatasthapana on 11 October, Dussehra on 20 October. */
const FIRST_NIGHT_UTC = Date.UTC(2026, 9, 11);
const NIGHTS = 9;

const IST_OFFSET_MS = 330 * 60 * 1000;
export const NIGHT_STARTS_AT_HOUR_IST = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar date (as a UTC midnight timestamp) of the night `now` falls in. */
function nightDate(now: Date): number {
  const shifted = now.getTime() + IST_OFFSET_MS - NIGHT_STARTS_AT_HOUR_IST * 60 * 60 * 1000;
  return Math.floor(shifted / DAY_MS) * DAY_MS;
}

/** The instant the current night began: 6 am IST today, or yesterday before 6 am. */
export function nightStart(now: Date = new Date()): Date {
  return new Date(
    nightDate(now) + NIGHT_STARTS_AT_HOUR_IST * 60 * 60 * 1000 - IST_OFFSET_MS,
  );
}

/**
 * Which night of Navratri `now` falls in: 1 to 9 during the festival, 0 the
 * night before it, negative before that and 10 or more once it is over.
 */
export function navratriNight(now: Date = new Date()): number {
  return Math.round((nightDate(now) - FIRST_NIGHT_UTC) / DAY_MS) + 1;
}

/** Where we are in the festival: "Night 4 of Navratri." or "Navratri starts in 18 days." */
export function navratriStatus(now: Date = new Date()): string | null {
  const night = navratriNight(now);
  if (night >= 1 && night <= NIGHTS) {
    return night === NIGHTS ? "Last night of Navratri." : `Night ${night} of Navratri.`;
  }
  if (night === 0) return "Navratri starts tomorrow.";
  if (night < 0) return `Navratri starts in ${1 - night} days.`;
  return null;
}

/** The spin screen's header line: "Night 4 of Navratri. Find your partner." */
export function navratriLine(now: Date = new Date()): string {
  const status = navratriStatus(now);
  return status ? `${status} Find your partner.` : "Find your garba partner.";
}
