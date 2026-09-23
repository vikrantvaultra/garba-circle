/**
 * Central product rules for Garba Circle.
 * Every price is in paise so we never do float maths on money.
 */

export const APP_NAME = "Garba Circle";
export const APP_TAGLINE = "Apna Garba partner dhoondo";

/** Free spins every new dancer gets. City and gender are chosen on every spin, free or paid. */
export const FREE_SPINS = 5;

/** Packs only buy spins. Chat is free and untimed. */
export type PackKind = "spins";

export type Pack = {
  key: string;
  kind: PackKind;
  label: string;
  sublabel: string;
  amountPaise: number;
  /** Spins granted. 0 for the unlimited pass, which grants time instead. */
  grant: number;
  /** Unlimited spins until UNLIMITED_PASS_ENDS_AT instead of a count. */
  unlimited?: boolean;
  badge?: string;
};

/**
 * The unlimited pass is a Navratri season pass: every spin is free until
 * Dussehra night is over (6 am IST on 21 October 2026). It stops being sold
 * once that moment has passed.
 */
export const UNLIMITED_PASS_ENDS_AT = new Date("2026-10-21T06:00:00+05:30");
export const UNLIMITED_PASS_ENDS_LABEL = "Dussehra, 20 Oct";

export const SPIN_PACKS: Pack[] = [
  {
    key: "spins_5",
    kind: "spins",
    label: "5 spins",
    sublabel: "Keep spinning",
    amountPaise: 4900,
    grant: 5,
  },
  {
    key: "spins_unlimited",
    kind: "spins",
    label: "Unlimited spins",
    sublabel: `Every spin free till ${UNLIMITED_PASS_ENDS_LABEL}`,
    amountPaise: 9900,
    grant: 0,
    unlimited: true,
  },
];

/**
 * No longer sold, but an order created before a pack was retired must still
 * be granted when its payment is confirmed.
 */
const RETIRED_PACKS: Pack[] = [
  {
    key: "spins_10",
    kind: "spins",
    label: "10 Searches",
    sublabel: "Retired",
    amountPaise: 3100,
    grant: 10,
  },
];

/** Packs on sale right now. The pass disappears once its season is over. */
export function packsOnSale(now: Date = new Date()): Pack[] {
  return SPIN_PACKS.filter((p) => !p.unlimited || now < UNLIMITED_PASS_ENDS_AT);
}

/** For confirming payments: includes retired packs. */
export function findPack(key: string): Pack | undefined {
  return [...SPIN_PACKS, ...RETIRED_PACKS].find((p) => p.key === key);
}

export function rupees(paise: number): string {
  return "₹" + (paise / 100).toFixed(paise % 100 === 0 ? 0 : 2);
}

/** Moderation escalation. */
export const STRIKES_FOR_CHAT_BAN = 3;
export const CHAT_BAN_HOURS = 24;
export const STRIKES_FOR_SUSPENSION = 6;

/** OTP behaviour. */
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 45;

export const DANCE_STYLES = [
  "Garba",
  "Dandiya Raas",
  "Sanedo",
  "Hinch",
  "Dodhiyu",
  "Titodo",
  "Bollywood",
] as const;

export const SKILL_LEVELS = [
  { key: "beginner", label: "Nano / Beginner", hint: "Teach me the 3 taali" },
  { key: "intermediate", label: "Timli / Intermediate", hint: "I can keep the beat" },
  { key: "pro", label: "Raas Rani / Pro", hint: "12 steps, no breaks" },
] as const;

export const GENDERS = [
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "other", label: "Other" },
] as const;

export const POPULAR_CITIES = [
  "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Mumbai",
  "Thane", "Navi Mumbai", "Pune", "Nashik", "Nagpur", "Indore",
  "Bhopal", "Jaipur", "Delhi", "Gurugram", "Noida", "Bengaluru",
  "Hyderabad", "Chennai", "Kolkata", "Bhavnagar", "Jamnagar", "Anand",
];
