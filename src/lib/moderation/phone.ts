/**
 * Contact-sharing detection.
 *
 * The brief was blunt: a phone number must not get through "in text, in
 * numbers, in roman numerals, or any other possible way". So instead of
 * regexing for ten digits, we rebuild the number the way a human reader would:
 *
 *   1. fold every script's numerals to ASCII                    (normalize.ts)
 *   2. strip every separator, so "98765 - 43210" is one run
 *   3. read spelled-out numbers in en/hi/mr/gu                  (numbers.ts)
 *   4. read roman numerals, "double 5", and leetspeak digits
 *   5. stitch fragments together across consecutive messages
 *
 * Only then do we decide. Everything here is pure and synchronous so it can be
 * unit-tested without a database.
 */

import { baseNormalize, squash, DIGIT_LEET } from "./normalize";
import {
  NUMBER_WORDS,
  NUMBER_WORD_KEYS,
  AMBIGUOUS_NUMBER_WORDS,
  REPEAT_WORDS,
  REPEAT_WORD_KEYS,
  isRomanNumeralToken,
  romanToDigits,
} from "./numbers";

export type { ContactFinding, ContactFindingKind } from "./types";
import type { ContactFinding } from "./types";

export type ContactScan = {
  findings: ContactFinding[];
  /** Digits worth remembering for the next message from this sender. */
  carry: string;
};

/**
 * "Strong" intent words name a contact channel outright. They justify blocking
 * even a partial number. "Weak" ones ("no", "call") are far too common in
 * ordinary chat to carry that weight on their own.
 */
const STRONG_INTENT_PATTERNS: RegExp[] = [
  /\b(numb?er|numbr|nmbr|num|digits?|contact|mobile|mob|cell|fone|phone)\b/,
  /\b(whats?app|wats?app|wtsp|watsap|telegram|insta(gram)?|snap(chat)?|discord|signal)\b/,
  /नंबर|नम्बर|क्रमांक|फोन|संपर्क/,
  /નંબર|ફોન/,
];

const WEAK_INTENT_PATTERNS: RegExp[] = [
  /\b(no|call|ring|missed\s?call|dial|ping|dm|inbox|tg|wp)\b/,
];

/**
 * Verbs that turn a contact word into an actual ask or offer.
 * Indic scripts need lookaround boundaries — JavaScript's \b only understands
 * ASCII word characters, so it never fires between a space and a Devanagari
 * letter.
 */
const EXCHANGE_PATTERNS: RegExp[] = [
  /\b(de|dedo|de-do|dena|dedena|do|dijiye|dijie|dya|dyaa|bhej|bhejo|bheje|pathav|pathava|mokal|send|share|give|gimme|batao|bata|bta|sang|sanga|saang|aapo|apo|lelo|le|note|save|type|likh)\b/,
  /\b(kya|kaun|konsa|what'?s|whats|wats|tera|teri|tumhara|tumcha|tumche|tamaro|tamru|apna|aapka|apko)\b/,
  /(?<![\p{L}\p{M}])(द्या|दे|दो|देदो|देना|भेज|भेजो|पाठव|सांग|बता|बताओ)(?![\p{L}\p{M}])/u,
  /(?<![\p{L}\p{M}])(આપ|આપો|મોકલ)(?![\p{L}\p{M}])/u,
];

const YEAR_LIST_RE = /^(?:(?:19|20)\d{2}){2,4}$/;
const SINGLE_YEAR_RE = /^(?:19|20)\d{2}$/;

type ComposedRun = {
  digits: string;
  spelledTokens: number;
  /** True when every token was a literal numeral rather than a word. */
  pureDigits: boolean;
};

/**
 * Should this run be banked for stitching onto the next message?
 *
 * Deliberately narrow. "I am 25" and "my flat is 402" must not be banked, or
 * an innocent follow-up message would stitch into a false accusation. But
 * spelled-out digits are never accidental, and neither is a four-digit-plus
 * run that is not a year.
 */
function isCarryWorthy(best: ComposedRun, strongIntent: boolean): boolean {
  if (best.digits.length < 2 || best.digits.length >= 10) return false;
  if (strongIntent) return true;
  if (best.spelledTokens >= 2) return true;
  return (
    best.pureDigits &&
    best.digits.length >= 4 &&
    !SINGLE_YEAR_RE.test(best.digits)
  );
}

type NumToken = {
  kind: "digit" | "word" | "repeat";
  /** digits contributed, or "" for a repeat marker */
  digits: string;
  /** repeat multiplier for "double"/"triple" */
  repeat?: number;
  ambiguous?: boolean;
  start: number;
  end: number;
};

/**
 * Walk the squashed text once, emitting a token for every numeral, spelled
 * number, or repeat marker. Anything else ends the current run.
 */
function tokenizeNumbers(sq: string): NumToken[][] {
  const runs: NumToken[][] = [];
  let current: NumToken[] = [];
  let i = 0;

  const closeRun = () => {
    if (current.length) runs.push(current);
    current = [];
  };

  while (i < sq.length) {
    const ch = sq[i];

    if (ch >= "0" && ch <= "9") {
      let j = i;
      while (j < sq.length && sq[j] >= "0" && sq[j] <= "9") j++;
      current.push({ kind: "digit", digits: sq.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    let matched = false;

    for (const key of REPEAT_WORD_KEYS) {
      if (sq.startsWith(key, i)) {
        current.push({
          kind: "repeat",
          digits: "",
          repeat: REPEAT_WORDS[key],
          start: i,
          end: i + key.length,
        });
        i += key.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const key of NUMBER_WORD_KEYS) {
      if (sq.startsWith(key, i)) {
        current.push({
          kind: "word",
          digits: NUMBER_WORDS[key],
          ambiguous: AMBIGUOUS_NUMBER_WORDS.has(key),
          start: i,
          end: i + key.length,
        });
        i += key.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    closeRun();
    i += 1;
  }

  closeRun();
  return runs;
}

/** Fold a run of tokens into the digit string it represents. */
function composeRun(run: NumToken[]): string {
  let out = "";
  let pendingRepeat = 0;

  for (const token of run) {
    if (token.kind === "repeat") {
      pendingRepeat = token.repeat ?? 0;
      continue;
    }
    if (pendingRepeat > 1 && token.digits.length === 1) {
      out += token.digits.repeat(pendingRepeat);
    } else {
      out += token.digits;
    }
    pendingRepeat = 0;
  }

  return out;
}

/**
 * "98765432lo" — the trailing letters are leetspeak digits glued to a long
 * digit run. Only extend when the whole adjacent letter block is leet-able and
 * short, so "9876543 ok" is left alone (k is not a leet digit).
 */
function extendWithLeet(sq: string, run: NumToken[], digits: string): string {
  if (digits.length < 6) return digits;

  const last = run[run.length - 1];
  let out = digits;
  let i = last.end;
  let tail = "";
  while (i < sq.length && /[a-z|!]/.test(sq[i]) && tail.length < 4) {
    const mapped = DIGIT_LEET[sq[i]];
    if (!mapped) return out; // a non-leet letter means this is real prose
    tail += mapped;
    i += 1;
  }
  if (tail.length > 0 && (i >= sq.length || !/[a-z]/.test(sq[i]))) out += tail;
  return out;
}

/** Roman numeral sequences: "IX VIII VII VI V IV III II I X". */
function romanRuns(base: string): string[] {
  const tokens = base.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const out: string[] = [];
  let run = "";
  let count = 0;

  const flush = () => {
    if (count >= 5) out.push(run);
    run = "";
    count = 0;
  };

  for (const token of tokens) {
    if (isRomanNumeralToken(token)) {
      run += romanToDigits(token);
      count += 1;
    } else if (/^\d+$/.test(token) && count > 0) {
      run += token;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

function hasStrongIntent(base: string): boolean {
  return STRONG_INTENT_PATTERNS.some((re) => re.test(base));
}

function hasIntent(base: string): boolean {
  return (
    hasStrongIntent(base) || WEAK_INTENT_PATTERNS.some((re) => re.test(base))
  );
}

function hasExchangeVerb(base: string): boolean {
  return EXCHANGE_PATTERNS.some((re) => re.test(base));
}

function looksLikeYearList(digits: string): boolean {
  return YEAR_LIST_RE.test(digits);
}

/** A 10-digit Indian mobile, with or without country code. */
function containsIndianMobile(digits: string): boolean {
  return /(?:0|91)?[6-9]\d{9}/.test(digits);
}

export type PhoneScanOptions = {
  /**
   * Digits this sender already emitted in the recent past. Lets us catch
   * "98765" followed a second later by "43210".
   */
  carryDigits?: string;
  /** Profile bios get the same treatment but never the fragment rule. */
  allowFragmentCarry?: boolean;
};

export function scanForContactSharing(
  raw: string,
  options: PhoneScanOptions = {},
): ContactScan {
  const base = baseNormalize(raw);
  const sq = squash(base);
  const findings: ContactFinding[] = [];

  const intent = hasIntent(base);
  const strongIntent = hasStrongIntent(base);

  // --- numeric runs -------------------------------------------------------
  const runs = tokenizeNumbers(sq);
  const composed: ComposedRun[] = [];

  for (const run of runs) {
    const meaningful = run.filter((t) => t.kind !== "repeat");
    if (meaningful.length === 0) continue;

    // A lone "do"/"be"/"one" buried inside an ordinary word is not a number.
    const onlyAmbiguousWords =
      meaningful.every((t) => t.kind === "word" && t.ambiguous) &&
      meaningful.length < 3;
    if (onlyAmbiguousWords) continue;

    let digits = composeRun(run);
    digits = extendWithLeet(sq, run, digits);
    // Two digits is the floor. A short run can never trigger a block by
    // itself, but "seven six six" is exactly what a number looks like when
    // it is being feathered across several messages, so it has to survive
    // long enough to reach the cross-message buffer.
    if (digits.length < 2) continue;

    composed.push({
      digits,
      // "double"/"triple" count as spelling a number out, same as "nau".
      spelledTokens: run.filter(
        (t) => t.kind === "word" || t.kind === "repeat",
      ).length,
      pureDigits: meaningful.every((t) => t.kind === "digit"),
    });
  }

  for (const digits of romanRuns(base)) {
    if (digits.length >= 4) {
      composed.push({ digits, spelledTokens: digits.length, pureDigits: false });
    }
  }

  let best: ComposedRun = { digits: "", spelledTokens: 0, pureDigits: true };
  for (const candidate of composed) {
    if (candidate.digits.length > best.digits.length) best = candidate;
  }

  const carry = options.carryDigits ?? "";
  const stitched = carry + best.digits;

  const isYearNoise = looksLikeYearList(best.digits);

  if (!isYearNoise) {
    if (containsIndianMobile(best.digits)) {
      findings.push({
        kind: "phone",
        reason: "A 10-digit mobile number was detected.",
      });
    } else if (best.digits.length >= 10) {
      findings.push({
        kind: "phone",
        reason: `A ${best.digits.length}-digit sequence was detected.`,
      });
    } else if (best.digits.length >= 7 && (intent || best.spelledTokens >= 2)) {
      findings.push({
        kind: "phone",
        reason: "A phone-length number was detected.",
      });
    } else if (best.digits.length >= 5 && strongIntent) {
      // Half a number sitting next to the word "number" is still someone
      // handing over their number, usually across two messages.
      findings.push({
        kind: "phone",
        reason: "Part of a phone number was shared alongside contact intent.",
      });
    } else if (
      best.digits.length >= 4 &&
      best.spelledTokens >= 3 &&
      strongIntent
    ) {
      // "seven two zero eight this is my number" — nobody spells three or
      // more digits out loud next to the word "number" by accident.
      findings.push({
        kind: "phone",
        reason: "Digits were spelled out alongside contact intent.",
      });
    } else if (
      best.digits.length >= 2 &&
      carry.length >= 2 &&
      (stitched.length >= 10 || containsIndianMobile(stitched))
    ) {
      findings.push({
        kind: "phone_fragment",
        reason: "A number was being sent a few digits at a time.",
      });
    } else if (best.digits.length >= 6 && intent && hasExchangeVerb(base)) {
      findings.push({
        kind: "phone",
        reason: "A number was being handed over.",
      });
    }
  }

  // Asking for the number is blocked too — otherwise the filter only stops
  // half of the exchange.
  if (
    findings.length === 0 &&
    intent &&
    hasExchangeVerb(base) &&
    /\b(numb?er|numbr|nmbr|num|digits?|contact|mobile|mob|whats?app|wats?app|insta(gram)?|snap(chat)?|telegram)\b|नंबर|नम्बर|નંબર/.test(
      base,
    )
  ) {
    findings.push({
      kind: "phone_request",
      reason: "Asking for off-platform contact details.",
    });
  }

  // Remember fragments so the next message can be stitched onto them.
  // An empty string means "this message added nothing", NOT "forget what you
  // had" — otherwise one chatty message in the middle ("seven six six" is not
  // carry-worthy on a strict reading) would erase the digits already banked.
  const fragmentCarry =
    !isYearNoise && isCarryWorthy(best, strongIntent)
      ? (carry + best.digits).slice(-14)
      : "";

  return { findings, carry: fragmentCarry };
}

/** Digits worth remembering from a message that was allowed through. */
export function extractCarryDigits(raw: string): string {
  return scanForContactSharing(raw).carry;
}
