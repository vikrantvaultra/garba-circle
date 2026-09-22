/**
 * Abusive-language detection across English, Hindi, Marathi and Gujarati,
 * resistant to the usual evasions: st r e t ch ed letters, l33t, dots between
 * every character, and mixed scripts.
 */

import {
  normalizeForModeration,
  collapseRepeats,
  squash,
  tidyWhitespace,
} from "./normalize";
import {
  LONG_SEVERE,
  WORD_SEVERE,
  LONG_MODERATE,
  WORD_MODERATE,
  WORD_MILD,
  SEVERE_PATTERNS,
  LONG_SLURS,
} from "./lexicon";

export type AbuseSeverity = "severe" | "moderate" | "mild";

export type AbuseFinding = {
  severity: AbuseSeverity;
  /** What matched — stored for moderator review, never shown to the sender. */
  term: string;
  label: string;
};

/**
 * Pre-collapse the lexicon once at module load rather than per message.
 *
 * The collapsed form is only usable when it is still distinctive. "xxx"
 * collapses to "x", and matching on that made every lone roman numeral X read
 * as severe abuse; "boobs" collapses to "bobs", which is somebody's name. So a
 * collapsed form that is too short is dropped and only the exact form counts.
 */
const MIN_COLLAPSED_SUBSTRING = 5;
const MIN_COLLAPSED_WORD = 3;

function prepareLong(terms: string[]) {
  return terms.map((t) => {
    const collapsed = collapseRepeats(squash(t));
    return {
      term: t,
      collapsed: collapsed.length >= MIN_COLLAPSED_SUBSTRING ? collapsed : null,
    };
  });
}

function prepareWords(terms: string[]) {
  return terms.map((t) => {
    const collapsed = collapseRepeats(t);
    return {
      term: t,
      collapsed: collapsed.length >= MIN_COLLAPSED_WORD ? collapsed : null,
    };
  });
}

const LONG_SEVERE_P = prepareLong(LONG_SEVERE);
const LONG_SLURS_P = prepareLong(LONG_SLURS);
const LONG_MODERATE_P = prepareLong(LONG_MODERATE);
const WORD_SEVERE_P = prepareWords(WORD_SEVERE);
const WORD_MODERATE_P = prepareWords(WORD_MODERATE);
const WORD_MILD_P = prepareWords(WORD_MILD);

function glueSingleLetterRuns(tokens: string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];

  const flush = () => {
    if (run.length >= 3) out.push(run.join(""));
    run = [];
  };

  for (const token of tokens) {
    if ([...token].length === 1) run.push(token);
    else flush();
  }
  flush();
  return out;
}

export function scanForAbuse(raw: string): AbuseFinding[] {
  const norm = normalizeForModeration(raw);

  // Two squashed views: one keeping doubled letters ("pussy"), one with every
  // repeat collapsed ("fuuuuck" -> "fuck"). A term hits if either view has it.
  const squashedExact = squash(norm.letters);
  const squashedCollapsed = norm.squashed;
  // A third view where symbols are deleted rather than read as letters.
  // "bhen@#$chod" only reassembles if @ is dropped, not turned into an "a".
  const squashedPlain = collapseRepeats(squash(norm.base));
  const spaced = tidyWhitespace(norm.letters);

  // Whole-token views, again in both repeat modes.
  const rawTokens = norm.letters.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokensExact = new Set(rawTokens);
  // Collapsed form -> the longest original token that produced it. A term is
  // only allowed to match its collapsed form when the text actually spelled
  // out at least as many characters, so "x" never stands in for "xxx" while
  // "fuuuuck" still matches "fuck".
  const collapsedLengths = new Map<string, number>();
  const noteCollapsed = (token: string) => {
    const key = collapseRepeats(token);
    const length = [...token].length;
    if ((collapsedLengths.get(key) ?? 0) < length) {
      collapsedLengths.set(key, length);
    }
  };
  for (const token of rawTokens) noteCollapsed(token);
  const tokensPlain = new Set(
    norm.base.split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean),
  );

  // "f u c k" is four tokens, so the whole-token lists never see it. Any run
  // of three or more single-character tokens is rejoined and matched as a
  // word. Ordinary prose almost never produces such a run.
  for (const glued of glueSingleLetterRuns(rawTokens)) {
    tokensExact.add(glued);
    noteCollapsed(glued);
  }

  const findings: AbuseFinding[] = [];
  const seen = new Set<string>();

  const push = (severity: AbuseSeverity, term: string, label: string) => {
    if (seen.has(term)) return;
    seen.add(term);
    findings.push({ severity, term, label });
  };

  const hitsLong = (entry: { term: string; collapsed: string | null }) => {
    if (squashedExact.includes(squash(entry.term))) return true;
    if (!entry.collapsed) return false;
    return (
      squashedCollapsed.includes(entry.collapsed) ||
      squashedPlain.includes(entry.collapsed)
    );
  };

  const hitsWord = (entry: { term: string; collapsed: string | null }) => {
    if (tokensExact.has(entry.term) || tokensPlain.has(entry.term)) return true;
    if (!entry.collapsed) return false;
    const spelled = collapsedLengths.get(entry.collapsed);
    return spelled !== undefined && spelled >= [...entry.term].length;
  };

  for (const entry of LONG_SEVERE_P) {
    if (hitsLong(entry)) push("severe", entry.term, "abusive language");
  }
  for (const entry of LONG_SLURS_P) {
    if (hitsLong(entry)) push("severe", entry.term, "slur");
  }
  for (const entry of WORD_SEVERE_P) {
    if (hitsWord(entry)) push("severe", entry.term, "abusive language");
  }
  for (const { re, label } of SEVERE_PATTERNS) {
    if (re.test(spaced)) push("severe", re.source.slice(0, 40), label);
  }
  for (const entry of LONG_MODERATE_P) {
    if (hitsLong(entry)) push("moderate", entry.term, "insult");
  }
  for (const entry of WORD_MODERATE_P) {
    if (hitsWord(entry)) push("moderate", entry.term, "insult");
  }
  for (const entry of WORD_MILD_P) {
    if (hitsWord(entry)) push("mild", entry.term, "mild language");
  }

  return findings;
}

export function worstSeverity(findings: AbuseFinding[]): AbuseSeverity | null {
  if (findings.some((f) => f.severity === "severe")) return "severe";
  if (findings.some((f) => f.severity === "moderate")) return "moderate";
  if (findings.some((f) => f.severity === "mild")) return "mild";
  return null;
}
