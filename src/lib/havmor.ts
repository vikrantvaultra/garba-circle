/**
 * The Havmor side of Garba Circle: the brand's links, and the flavours that
 * give each night, each jodi and each dancer a scoop of their own.
 *
 * Nothing here changes who anyone meets. The flavour a jodi gets is picked
 * from their tier and the other dancer's id, so it is the same every time the
 * pair is seen, but it never feeds back into matching or scoring.
 */

import type { Tier } from "@/lib/compat";
import { navratriNight } from "@/lib/navratri";

export const BRAND = "Havmor";
export const HAVMOR_SINCE = 1944;
export const HAVMOR_HOME = "https://www.havmor.com/";
export const HAVMOR_STORE_LOCATOR = "https://www.havmor.com/store-locator";

export type Flavour = {
  key: string;
  name: string;
  /** One line, in the voice of the app. */
  note: string;
  /** The scoop, and the shade used for its drip and outline. */
  color: string;
  deep: string;
  /** Havmor's own palette the flavour sits in, and its page on havmor.com. */
  palette: string;
  url: string;
};

const page = (path: string) => `${HAVMOR_HOME}${path}`;

const VANILLA: Flavour = {
  key: "vanilla",
  name: "Vanilla",
  note: "Pure and classic. The first scoop of every celebration.",
  color: "#FFF1CC",
  deep: "#E2C27E",
  palette: "Classics",
  url: page("all-products"),
};
const STRAWBERRY: Flavour = {
  key: "strawberry",
  name: "Mahabaleshwar Strawberry",
  note: "Fresh from the hills, pink as a new chaniya.",
  color: "#FF9AAE",
  deep: "#E0526B",
  palette: "Fruits",
  url: page("fruits"),
};
const RAJBHOG: Flavour = {
  key: "rajbhog",
  name: "Rajbhog",
  note: "Kesar, pista and badam. Festive in every spoon.",
  color: "#FFD36B",
  deep: "#D99A1E",
  palette: "Indian Traditional",
  url: page("indian-traditional"),
};
const TRIPLE_CHOCOLATE: Flavour = {
  key: "triple-chocolate",
  name: "Triple Chocolate",
  note: "For the ones who dance till the last aarti.",
  color: "#8A5540",
  deep: "#4F2C1F",
  palette: "Chocolate",
  url: page("chocolate"),
};
const WILD_BERRIES: Flavour = {
  key: "wild-berries",
  name: "Wild Berries",
  note: "A little wild, like the fourth round of Dodhiyu.",
  color: "#B55FA0",
  deep: "#6E2A63",
  palette: "Fruits",
  url: page("wild-berries"),
};
const COOKIE_N_CREAM: Flavour = {
  key: "cookie-n-cream",
  name: "Cookie n Cream",
  note: "Classic with a crunch. Easy to love.",
  color: "#F3ECE2",
  deep: "#3B2A24",
  palette: "International",
  url: page("cookie-n-cream"),
};
const HAZELNUT: Flavour = {
  key: "hazelnut",
  name: "Hazelnut",
  note: "Smooth moves with a nutty finish.",
  color: "#CF9D66",
  deep: "#8E5C2E",
  palette: "International",
  url: page("international-others"),
};
const CHOCO_TRUFFLE: Flavour = {
  key: "choco-truffle",
  name: "Choco Truffle",
  note: "Deep, dark and good all night long.",
  color: "#6A3627",
  deep: "#2E150E",
  palette: "Chocolate",
  url: page("chocolate"),
};
const RAJWADI: Flavour = {
  key: "rajwadi",
  name: "Rajwadi Kulfi Falooda",
  note: "Royal, rich and made to share.",
  color: "#F7C58E",
  deep: "#C9772F",
  palette: "Indian Traditional",
  url: page("Rajwadi-Kulfi-Falooda"),
};

/** Nine nights, nine flavours, ending on the royal one for the last garba. */
export const NIGHT_FLAVOURS: Flavour[] = [
  STRAWBERRY,
  RAJBHOG,
  TRIPLE_CHOCOLATE,
  VANILLA,
  WILD_BERRIES,
  COOKIE_N_CREAM,
  HAZELNUT,
  CHOCO_TRUFFLE,
  RAJWADI,
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The flavour for tonight. During Navratri each night has its own; before
 * and after, the nine take turns a day at a time so the card still changes.
 */
export function flavourOfTheNight(now: Date = new Date()): {
  flavour: Flavour;
  label: string;
} {
  const night = navratriNight(now);
  if (night >= 1 && night <= NIGHT_FLAVOURS.length) {
    return { flavour: NIGHT_FLAVOURS[night - 1], label: `Flavour of Night ${night}` };
  }
  const day = Math.floor(now.getTime() / DAY_MS);
  return {
    flavour: NIGHT_FLAVOURS[((day % NIGHT_FLAVOURS.length) + NIGHT_FLAVOURS.length) % NIGHT_FLAVOURS.length],
    label: "Today’s flavour",
  };
}

/** How many scoops a jodi is worth: one, a double, or the full royal three. */
export const TIER_SCOOPS: Record<Tier, number> = { jodi: 1, rare: 2, soulmate: 3 };

const JODI_FLAVOURS = [STRAWBERRY, VANILLA, COOKIE_N_CREAM, HAZELNUT, WILD_BERRIES];
const RARE_FLAVOURS = [RAJBHOG, TRIPLE_CHOCOLATE, CHOCO_TRUFFLE];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The scoop to share with someone the circle landed on. */
export function jodiScoop(partnerId: string, tier: Tier): { flavour: Flavour; line: string } {
  if (tier === "soulmate") {
    return { flavour: RAJWADI, line: "A royal match deserves the royal scoop. Share one between rounds." };
  }
  const pool = tier === "rare" ? RARE_FLAVOURS : JODI_FLAVOURS;
  const flavour = pool[hash(partnerId) % pool.length];
  return {
    flavour,
    line:
      tier === "rare"
        ? `A double-scoop jodi. Cool off with a ${flavour.name} after the first round.`
        : `Your jodi scoop. Grab a ${flavour.name} between rounds.`,
  };
}

/** A dancer's flavour, from how long they can keep going on the floor. */
export function levelFlavour(skillLevel: string | null): { flavour: Flavour; line: string } | null {
  switch (skillLevel) {
    case "beginner":
      return { flavour: VANILLA, line: "Classic and easy-going. Everyone starts with vanilla." };
    case "intermediate":
      return { flavour: COOKIE_N_CREAM, line: "Keeps the beat, with a little crunch." };
    case "pro":
      return { flavour: RAJWADI, line: "Twelve steps, no breaks. Royalty on the floor." };
    default:
      return null;
  }
}
