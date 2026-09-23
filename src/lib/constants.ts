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
  /** Spins granted. */
  grant: number;
  badge?: string;
};

export const SPIN_PACKS: Pack[] = [
  {
    key: "spins_5",
    kind: "spins",
    label: "5 Searches",
    sublabel: "Keep spinning",
    amountPaise: 2100,
    grant: 5,
  },
  {
    key: "spins_10",
    kind: "spins",
    label: "10 Searches",
    sublabel: "Best value — save ₹11",
    amountPaise: 3100,
    grant: 10,
    badge: "POPULAR",
  },
];

export const ALL_PACKS = SPIN_PACKS;

export function findPack(key: string): Pack | undefined {
  return ALL_PACKS.find((p) => p.key === key);
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
