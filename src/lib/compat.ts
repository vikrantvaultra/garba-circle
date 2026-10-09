/**
 * How well two dancers fit, from things both of them actually chose: dance
 * styles, city, skill level and age. No randomness, so the same pair always
 * gets the same number and the reason shown under it is the real reason.
 */

import type { PublicProfile } from "@/lib/api";

export type Tier = "jodi" | "rare" | "soulmate";

type Side = {
  city: string | null;
  danceStyles: string[];
  skillLevel: string | null;
  age: number | null;
};

export type Compat = {
  pct: number;
  tier: Tier;
  shared: string[];
  reason: string;
};

const BASE = 62;
const PER_SHARED_STYLE = 12; // counted for up to two styles
const SAME_CITY = 8;
const SAME_SKILL = 4;
const CLOSE_IN_AGE = 2; // within four years

const RARE_FROM = 82;
const SOULMATE_FROM = 96;

function same(a: string | null, b: string | null): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

export function compatibility(me: Side, them: Side): Compat {
  const shared = them.danceStyles.filter((s) => me.danceStyles.includes(s));
  const sameCity = same(me.city, them.city);
  const sameSkill = same(me.skillLevel, them.skillLevel);
  const closeInAge =
    me.age != null && them.age != null && Math.abs(me.age - them.age) <= 4;

  const pct = Math.min(
    100,
    BASE +
      Math.min(shared.length, 2) * PER_SHARED_STYLE +
      (sameCity ? SAME_CITY : 0) +
      (sameSkill ? SAME_SKILL : 0) +
      (closeInAge ? CLOSE_IN_AGE : 0),
  );

  const tier: Tier =
    pct >= SOULMATE_FROM ? "soulmate" : pct >= RARE_FROM ? "rare" : "jodi";

  let reason: string;
  if (shared.length > 0) {
    reason = `You both love ${shared.slice(0, 2).join(" and ")}`;
    if (sameCity && them.city) reason += `, both in ${them.city.trim()}`;
  } else if (sameCity && them.city) {
    reason = `You're both dancing in ${them.city.trim()}`;
  } else if (sameSkill) {
    reason = "Same level on the floor";
  } else {
    reason = "Someone new for your circle";
  }

  return { pct, tier, shared, reason };
}

/** Someone the circle landed on, and how well they fit. */
export type Landing = Compat & { profile: PublicProfile };

export const TIER_KICKER: Record<Tier, string> = {
  jodi: "It's a jodi",
  rare: "Double-scoop jodi",
  soulmate: "Dandiya soulmate",
};
