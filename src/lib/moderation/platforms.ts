/**
 * Off-platform contact detection: links, app names, handles and invitations to
 * continue the conversation somewhere else.
 *
 * The rule from the brief is absolute — no links, and no naming a platform
 * where two people could carry on talking. So merely writing "instagram" is
 * blocked, not only "instagram.com/rahul". That is a deliberately strict call:
 * "I saw your Instagram reel" gets blocked too, and that is the accepted cost
 * of keeping every conversation inside Garba Circle.
 *
 * The strictness is spent carefully. Names that double as ordinary words —
 * "signal" (network signal), "line", "meet", "hike", "Josh" (a common name),
 * "imo" (in my opinion) — only count when something nearby shows app intent.
 * Blocking "signal nahi aa raha" would be a worse failure than missing one
 * oblique reference.
 */

import { baseNormalize, squash, tidyWhitespace } from "./normalize";
import type { ContactFinding } from "./types";

/**
 * Written out, these are never anything but the app. Matched as substrings, so
 * every entry must be long and distinctive enough that a substring hit cannot
 * be an accident — "insta" is excluded here because of "instant".
 */
const PLATFORM_SUBSTRINGS = [
  "instagram", "instragram", "instagrm",
  "whatsapp", "watsapp", "whatsap", "wattsapp", "whatapp",
  "telegram", "telegrm",
  "snapchat", "snapchatt",
  "facebook", "faceboook", "messenger",
  "discord", "tiktok", "skype", "viber", "wechat", "linkedin",
  "tinder", "bumble", "hinge", "omegle", "grindr",
  "sharechat", "chingari", "truecaller", "hellotalk",
  "gmail", "yahoo", "hotmail", "outlook", "protonmail", "rediffmail",
  "icloud", "zoho",
  "linktree", "linktr", "onlyfans", "twitter", "pinterest",
  "reddit", "quora", "hangouts", "clubhouse", "telegrams",
  // Devanagari
  "इंस्टा", "इंस्टाग्राम", "टेलीग्राम",
  "व्हाट्सएप", "वाट्सएप", "स्नैपचैट", "फेसबुक",
  // Gujarati
  "ઇન્સ્ટા", "ટેલિગ્રામ", "વોટ્સએપ",
];

/** Short, but in a chat they only ever mean the app. Matched whole-token. */
const PLATFORM_TOKENS = [
  "insta", "instagram", "instaid", "igid",
  "ig", "fb", "wa", "wtsp", "wts", "wapp", "tg",
  "snap", "snapchat", "whatsapp", "telegram",
  "dm", "dms", "inbox",
];

/**
 * Ambiguous on their own. These need a nearby app-intent word before they
 * count, because each is a perfectly ordinary thing to say.
 */
const AMBIGUOUS_PLATFORM_TOKENS = [
  "signal", "line", "meet", "teams", "zoom", "hike", "josh", "moj",
  "imo", "kik", "botim", "sc", "x", "tt",
];

/**
 * An ambiguous name only counts when an app-ish qualifier sits right next to
 * it. Proximity is the whole point: "google meet link" is an app, "lets meet
 * at the ground" is a plan, and the only difference is the neighbouring word.
 */
const QUALIFIER_BEFORE =
  "(?:add|adding|join|joining|dm|invite|username|handle|profile|account|id|ids|link|group|call|scan|qr|download|install|search|follow|connect|open)";
const QUALIFIER_AFTER =
  "(?:app|id|ids|link|group|call|meeting|invite|username|handle|profile|account|pe|par|pr|karo|kar|chalo|aao|aaja|aajao|join|add)";

function escapeToken(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Before: a qualifier, then up to two words, then the name.
 * After: the name, then at most one word, then a qualifier.
 * The tighter trailing window is deliberate — "meet me at gate 3" must stay
 * clear of it.
 */
const AMBIGUOUS_PATTERNS = AMBIGUOUS_PLATFORM_TOKENS.map((token) => {
  const t = escapeToken(token);
  return new RegExp(
    `\\b${QUALIFIER_BEFORE}\\b(?:\\W+\\w+){0,2}\\W+\\b${t}\\b` +
      `|\\b${t}\\b(?:\\W+\\w+){0,1}\\W+\\b${QUALIFIER_AFTER}\\b`,
    "i",
  );
});

/** An explicit "let's go somewhere else". */
const MOVE_PATTERNS: RegExp[] = [
  /\b(kisi|kahin|kahi|koi|dusre|dusri|another|other|different)\s+(aur\s+)?(app|jagah|platform|place|site|website)\b/,
  /\b(app|platform)\s+(pe|par|pr|me|mein|on)\s+(baat|chat|talk|milte|aao|aaja)\b/,
  /\b(lets|let's|chalo|chal)\s+(talk|chat|baat)\s+(on|pe|par|somewhere|kahin)\b/,
  /\b(move|shift|switch)\s+(to|this|our)\b.{0,16}\b(chat|talk|app|conversation)\b/,
  /\b(off|outside)\s+(this\s+)?(app|platform|site)\b/,
];

/** Someone handing over an account name. */
const HANDLE_PATTERNS: RegExp[] = [
  /(?:^|\s)@[a-z0-9._]{3,30}\b/i,
  /\b(?:id|ids|username|user\s?name|handle|profile|account)\b\s*(?:is|hai|che|ahe)?\s*[:=-]?\s*[a-z][a-z0-9._-]{3,}/i,
  /\b(?:add|follow|search|find)\s+(?:me\s+)?(?:as|on|at)?\s*[:=-]?\s*@?[a-z][a-z0-9._-]{4,}\b/i,
];

/** Broad but finite. A bare "foo.com" is a link even without a scheme. */
const TLDS =
  "com|in|net|org|me|co|io|gg|ly|be|app|link|live|online|site|xyz|info|biz|us|uk|ca|au|tv|fm|to|cc|ws|ee|sh|st|id|pw|club|shop|store|page|bio|so|gl|tk|dev|ai|social|chat|one|space|fun|life|world|today|news|blog";

const URL_PATTERNS: RegExp[] = [
  /\bhttps?:\/\/\S+/i,
  /\bwww\.\S+/i,
  new RegExp(`\\b[a-z0-9][a-z0-9-]{0,62}\\.(?:${TLDS})\\b(?:\\/\\S*)?`, "i"),
];

const EMAIL_RE =
  /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[a-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[a-z]{2,}/i;

const UPI_RE =
  /\b[a-z0-9._-]{3,}@(?:ok(?:icici|hdfcbank|axis|sbi)|paytm|ybl|ibl|apl|upi|axl|axisb|hdfcbank|icici|sbi|yesbank|pnb|fam|naviaxis|superyes)\b/i;

/**
 * Put obfuscated links back together before matching.
 * "instagram dot com slash rahul" and "t (dot) me" are links; writing the
 * punctuation as words is the oldest trick there is.
 */
export function deobfuscateLinks(input: string): string {
  return input
    .replace(/(\w)\s*[([{]?\s*(?:dot|d0t|punto)\s*[)\]}]?\s*(\w)/gi, "$1.$2")
    .replace(/(\w)\s*[([{]\s*\.\s*[)\]}]\s*(\w)/g, "$1.$2")
    .replace(/(\w)\s*(?:slash|\/{1,2})\s*(\w)/gi, "$1/$2")
    .replace(/\b(?:h\s*t\s*t\s*p\s*s?)\s*:?\s*\/\/?/gi, "http://");
}

function tokensOf(text: string): Set<string> {
  return new Set(text.split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean));
}

export function scanForPlatformSharing(raw: string): ContactFinding[] {
  const base = baseNormalize(raw);
  const deobfuscated = deobfuscateLinks(base);
  const spaced = tidyWhitespace(deobfuscated);
  const squashed = squash(base);
  const tokens = tokensOf(deobfuscated);

  const findings: ContactFinding[] = [];
  const seen = new Set<string>();
  const add = (finding: ContactFinding) => {
    if (seen.has(finding.kind)) return;
    seen.add(finding.kind);
    findings.push(finding);
  };

  // Links first: they are the least ambiguous and the most actionable.
  if (URL_PATTERNS.some((re) => re.test(spaced))) {
    add({ kind: "url", reason: "A link was detected." });
  }

  if (UPI_RE.test(spaced)) {
    add({ kind: "upi", reason: "A UPI ID was detected." });
  } else if (EMAIL_RE.test(spaced)) {
    add({ kind: "email", reason: "An email address was detected." });
  }

  // Named platforms.
  const namedPlatform =
    PLATFORM_SUBSTRINGS.some((name) => squashed.includes(name)) ||
    PLATFORM_TOKENS.some((name) => tokens.has(name));

  const ambiguousPlatform = AMBIGUOUS_PATTERNS.some((re) => re.test(spaced));

  if (namedPlatform || ambiguousPlatform) {
    add({
      kind: "platform",
      reason: "Another app was named as a place to continue talking.",
    });
  }

  if (MOVE_PATTERNS.some((re) => re.test(spaced))) {
    add({
      kind: "move_off_platform",
      reason: "An invitation to move the conversation elsewhere.",
    });
  }

  // A handle only matters as a way to be found somewhere else, so it counts
  // on its own — "@rahul_patel" needs no platform named beside it.
  if (HANDLE_PATTERNS.some((re) => re.test(raw)) && !seen.has("platform")) {
    add({ kind: "handle", reason: "An account name was being shared." });
  }

  return findings;
}
