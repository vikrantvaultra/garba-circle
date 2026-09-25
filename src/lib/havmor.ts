/**
 * The Havmor side of Garba Circle: the brand's links, and the Havmor
 * products that give each night, each jodi and each dancer a flavour.
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
  /** The product photo, cut out of its background (scripts/brand-assets.mjs). */
  image: string;
  /** A soft backdrop for the photo, drawn from the pack's own colours. */
  tint: string;
  /** Havmor's own range the product sits in, and its page on havmor.com. */
  palette: string;
  url: string;
};

const page = (path: string) => `${HAVMOR_HOME}${path}`;
const photo = (name: string) => `/brand/products/${name}.webp`;

const STRAWBERRY: Flavour = {
  key: "strawberry",
  name: "Mahabaleshwar Strawberry",
  note: "Fresh from the hills, pink as a new chaniya.",
  image: photo("strawberry"),
  tint: "#FBE3E8",
  palette: "Fruits",
  url: page("fruits"),
};
const KESAR_PISTA: Flavour = {
  key: "kesar-pista",
  name: "Kesar Pista",
  note: "Saffron and pistachio, festive in every spoon. Zero sugar.",
  image: photo("kesar-pista"),
  tint: "#F3EDCF",
  palette: "Dry Fruits",
  url: page("dry-fruits"),
};
const CHOCO_BROWNIE: Flavour = {
  key: "choco-brownie",
  name: "Choco Brownie",
  note: "For the ones who dance till the last aarti.",
  image: photo("choco-brownie"),
  tint: "#F2E3DC",
  palette: "Chocolate",
  url: page("chocolate"),
};
const VANILLA: Flavour = {
  key: "vanilla",
  name: "Vanilla",
  note: "Pure and classic. The first scoop of every celebration.",
  image: photo("vanilla"),
  tint: "#E1F1F7",
  palette: "Classics",
  url: page("all-products"),
};
const WILD_BERRIES: Flavour = {
  key: "wild-berries",
  name: "Wild Berries",
  note: "A little wild, like the fourth round of Dodhiyu.",
  image: photo("wild-berries"),
  tint: "#F6E6EC",
  palette: "Fruits",
  url: page("wild-berries"),
};
const TURBO_CONE: Flavour = {
  key: "turbo-cone",
  name: "Turbo Cone",
  note: "Crunchy, chocolatey and quick. Made for the break between rounds.",
  image: photo("turbo-cone"),
  tint: "#E0F2F4",
  palette: "Cones",
  url: page("all-products"),
};
const NUTTY_BELGIAN: Flavour = {
  key: "nutty-belgian",
  name: "Nutty Belgian Dark Chocolate",
  note: "Deep, dark and good all night long.",
  image: photo("nutty-belgian"),
  tint: "#ECE3EE",
  palette: "Chocolate",
  url: page("chocolate"),
};
const ZULUBAR: Flavour = {
  key: "zulubar",
  name: "Zulubar Dark Crunch",
  note: "Dark chocolate with a crunch. Bold moves only.",
  image: photo("zulubar"),
  tint: "#EFE3D8",
  palette: "Chocolate",
  url: page("chocolate"),
};
const RAJWADI: Flavour = {
  key: "rajwadi",
  name: "Rajwadi Kulfi Falooda",
  note: "Royal, rich and made to share.",
  image: photo("rajwadi"),
  tint: "#ECE4F2",
  palette: "Indian Traditional",
  url: page("Rajwadi-Kulfi-Falooda"),
};

/** Nine nights, nine Havmor favourites, ending on the royal one for the last garba. */
export const NIGHT_FLAVOURS: Flavour[] = [
  STRAWBERRY,
  KESAR_PISTA,
  CHOCO_BROWNIE,
  VANILLA,
  WILD_BERRIES,
  TURBO_CONE,
  NUTTY_BELGIAN,
  ZULUBAR,
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

const JODI_FLAVOURS = [STRAWBERRY, VANILLA, WILD_BERRIES, TURBO_CONE, KESAR_PISTA];
const RARE_FLAVOURS = [CHOCO_BROWNIE, NUTTY_BELGIAN, ZULUBAR];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The Havmor treat to share with someone the circle landed on. */
export function jodiScoop(partnerId: string, tier: Tier): { flavour: Flavour; line: string } {
  if (tier === "soulmate") {
    return { flavour: RAJWADI, line: "A royal match deserves the royal treat. Share one between rounds." };
  }
  const pool = tier === "rare" ? RARE_FLAVOURS : JODI_FLAVOURS;
  const flavour = pool[hash(partnerId) % pool.length];
  return {
    flavour,
    line:
      tier === "rare"
        ? `A double-scoop jodi. Cool off with a ${flavour.name} after the first round.`
        : `Grab a ${flavour.name} together between rounds.`,
  };
}

/** A dancer's flavour, from how long they can keep going on the floor. */
export function levelFlavour(skillLevel: string | null): { flavour: Flavour; line: string } | null {
  switch (skillLevel) {
    case "beginner":
      return { flavour: VANILLA, line: "Classic and easy-going. Everyone starts with vanilla." };
    case "intermediate":
      return { flavour: CHOCO_BROWNIE, line: "Keeps the beat, rich all the way through." };
    case "pro":
      return { flavour: RAJWADI, line: "Twelve steps, no breaks. Royalty on the floor." };
    default:
      return null;
  }
}
