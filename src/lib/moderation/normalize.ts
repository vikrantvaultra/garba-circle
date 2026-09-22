/**
 * Text normalisation shared by every moderation pass.
 *
 * Users trying to sneak a phone number or a gaali past a filter reach for the
 * same tricks everywhere: full-width digits, Devanagari/Gujarati numerals,
 * keycap emoji, zero-width joiners between letters, leetspeak, stretched
 * vowels, dots between every character. Each helper below kills one of those
 * tricks, and the detectors compose them.
 */

/** Native digit blocks we fold down to ASCII 0-9. */
const DIGIT_BLOCK_STARTS = [
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic (Urdu)
  0x0966, // Devanagari  (Hindi / Marathi)
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Odia
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0e50, // Thai
  0xff10, // Full-width
];

const NATIVE_DIGITS = new Map<string, string>();
for (const start of DIGIT_BLOCK_STARTS) {
  for (let d = 0; d < 10; d++) {
    NATIVE_DIGITS.set(String.fromCodePoint(start + d), String(d));
  }
}

/** Enclosed / keycap / superscript digit forms. */
const ENCLOSED_DIGITS: Record<string, string> = {
  "⓪": "0", "①": "1", "②": "2", "③": "3", "④": "4",
  "⑤": "5", "⑥": "6", "⑦": "7", "⑧": "8", "⑨": "9",
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
  "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
  "❿": "0", "❶": "1", "❷": "2", "❸": "3", "❹": "4",
  "❺": "5", "❻": "6", "❼": "7", "❽": "8", "❾": "9",
};

/** Invisible characters used to break up words. */
const INVISIBLE = /[­͏؜᠎​-‏‪-‮⁠-⁤⁪-⁯﻿︀-️]/g;

/** Latin combining marks only — Indic matras must survive. */
const LATIN_COMBINING = /[̀-ͯ]/g;

/**
 * Keycap emoji: "1️⃣". The variation selector is stripped by
 * INVISIBLE, so we handle the bare "<digit>⃣" that remains.
 */
function foldKeycaps(input: string): string {
  return input.replace(/([0-9#*])⃣/g, "$1");
}

/** Fold every non-ASCII numeral form down to 0-9. */
export function foldDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    out += NATIVE_DIGITS.get(ch) ?? ENCLOSED_DIGITS[ch] ?? ch;
  }
  return out;
}

/**
 * Base normalisation: compatibility-decompose, drop invisibles and Latin
 * accents, fold numerals, lowercase. Indic text passes through intact.
 */
export function baseNormalize(input: string): string {
  return foldDigits(
    foldKeycaps(
      input.normalize("NFKC").replace(INVISIBLE, "").replace(LATIN_COMBINING, ""),
    ),
  ).toLowerCase();
}

/** Characters people substitute for letters. Applied to word-ish text only. */
const LETTER_LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "9": "g", "@": "a", "$": "s", "!": "i", "|": "i", "£": "l",
  "(": "c", "€": "e", "+": "t",
};

/** Letters people substitute for digits. Only used inside digit-dense runs. */
export const DIGIT_LEET: Record<string, string> = {
  o: "0", q: "9", i: "1", l: "1", j: "1", z: "2", e: "3", a: "4",
  s: "5", b: "6", t: "7", g: "9", "|": "1", "!": "1",
};

export function deLeetLetters(input: string): string {
  let out = "";
  for (const ch of input) out += LETTER_LEET[ch] ?? ch;
  return out;
}

/** "bhenchoooood" -> "bhenchod"; lexicon entries are stored collapsed too. */
export function collapseRepeats(input: string): string {
  return input.replace(/(.)\1+/gu, "$1");
}

/**
 * Everything that is not a letter, digit or combining mark disappears:
 * "b.h.e.n.c.h.o.d" -> "bhenchod". Marks must survive or Devanagari and
 * Gujarati words lose their matras ("\u0938\u093e\u0924" would become "\u0938\u0924") and stop
 * matching the vocabulary in numbers.ts.
 */
export function squash(input: string): string {
  return input.replace(/[^\p{L}\p{N}\p{M}]+/gu, "");
}

/** Collapse every run of whitespace to a single space and trim. */
export function tidyWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export type NormalizedText = {
  /** Original text, untouched. */
  raw: string;
  /** NFKC + invisibles stripped + numerals folded + lowercased. */
  base: string;
  /** base + leet letters resolved, used for lexicon matching. */
  letters: string;
  /** letters, repeats collapsed, separators kept. */
  collapsed: string;
  /** letters, repeats collapsed, every separator removed. */
  squashed: string;
  /** Word tokens from `collapsed`, Unicode aware. */
  tokens: string[];
};

export function normalizeForModeration(raw: string): NormalizedText {
  const base = baseNormalize(raw);
  const letters = deLeetLetters(base);
  const collapsed = collapseRepeats(letters);
  const squashed = squash(collapsed);
  const tokens = collapsed.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return { raw, base, letters, collapsed, squashed, tokens };
}
