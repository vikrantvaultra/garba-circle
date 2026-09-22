/**
 * Spoken-number vocabulary for the languages our dancers actually type in:
 * English, Hindi, Marathi and Gujarati — each in both the native script and
 * the romanised form people use on phone keyboards.
 *
 * This is what stops "nau aath saat chhe paanch chaar teen do ek shunya" from
 * being a perfectly good way to hand over a phone number.
 */

type WordMap = Record<string, string>;

const ENGLISH: WordMap = {
  zero: "0", nought: "0", naught: "0", oh: "0", nil: "0",
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
};

/** Hindi, romanised. Regional spellings included on purpose. */
const HINDI_ROMAN: WordMap = {
  shunya: "0", shoonya: "0", sunya: "0", sifar: "0", sifer: "0",
  ek: "1", eak: "1",
  do: "2", dho: "2",
  teen: "3", tin: "3", theen: "3",
  char: "4", chaar: "4", chār: "4",
  panch: "5", paanch: "5", pach: "5", paach: "5",
  che: "6", chhe: "6", chah: "6", chhah: "6", cheh: "6", chhah6: "6",
  saat: "7", sat: "7", saath: "7",
  aath: "8", ath: "8", aat: "8",
  nau: "9", nao: "9", now: "9",
};

/** Marathi, romanised. */
const MARATHI_ROMAN: WordMap = {
  don: "2", donn: "2",
  saha: "6", sahaa: "6", sah: "6",
  nauu: "9", nou: "9",
  paach: "5", pac: "5",
};

/** Gujarati, romanised — the home language of Garba. */
const GUJARATI_ROMAN: WordMap = {
  mindu: "0", minda: "0",
  be: "2", bey: "2",
  tran: "3", trann: "3", tarn: "3",
  chha: "6", chh: "6",
  nav: "9", nau9: "9",
  dus: "0",
};

/** Devanagari — covers Hindi and Marathi. */
const DEVANAGARI: WordMap = {
  "शून्य": "0", // शून्य
  "सिफर": "0",       // सिफर
  "एक": "1",                   // एक
  "दो": "2",                   // दो
  "दोन": "2",             // दोन (Marathi)
  "तीन": "3",             // तीन
  "चार": "4",             // चार
  "पांच": "5",       // पांच
  "पाँच": "5",       // पाँच
  "पाच": "5",             // पाच (Marathi)
  "छह": "6",                   // छह
  "छे": "6",                   // छे
  "सहा": "6",             // सहा (Marathi)
  "सात": "7",             // सात
  "आठ": "8",                   // आठ
  "नौ": "9",                   // नौ
  "नऊ": "9",                   // नऊ (Marathi)
};

/** Gujarati script. */
const GUJARATI: WordMap = {
  "શૂન્ય": "0", // શૂન્ય
  "એક": "1",                   // એક
  "બે": "2",                   // બે
  "ત્રણ": "3",       // ત્રણ
  "ચાર": "4",             // ચાર
  "પાંચ": "5",       // પાંચ
  "છ": "6",                         // છ
  "સાત": "7",             // સાત
  "આઠ": "8",                   // આઠ
  "નવ": "9",                   // નવ
};

export const NUMBER_WORDS: WordMap = {
  ...ENGLISH,
  ...HINDI_ROMAN,
  ...MARATHI_ROMAN,
  ...GUJARATI_ROMAN,
  ...DEVANAGARI,
  ...GUJARATI,
};

/**
 * Words that are far more often ordinary language than digits ("do you",
 * "be there", "no problem"). They still resolve to digits, but only when they
 * sit next to another number token — see the run grouping in phone.ts.
 */
export const AMBIGUOUS_NUMBER_WORDS = new Set([
  "do", "be", "no", "now", "che", "oh", "one", "for", "to", "too", "ek",
  "nav", "sat", "ath", "tin", "char", "nil", "dus", "bey", "o",
]);

/** Repeat markers: "double 5" -> 55, "triple 7" -> 777. */
export const REPEAT_WORDS: Record<string, number> = {
  double: 2, dubble: 2, dbl: 2, dabal: 2, doubl: 2,
  triple: 3, tripal: 3, tripple: 3, trippal: 3,
};

/** Number words sorted longest-first so greedy matching prefers "paanch" over "pa". */
export const NUMBER_WORD_KEYS = Object.keys(NUMBER_WORDS).sort(
  (a, b) => b.length - a.length,
);

export const REPEAT_WORD_KEYS = Object.keys(REPEAT_WORDS).sort(
  (a, b) => b.length - a.length,
);

const ROMAN_TOKEN = /^(?:i{1,3}|iv|vi{0,3}|ix|xi{0,3}|x)$/;
const ROMAN_VALUES: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13,
};

export function isRomanNumeralToken(token: string): boolean {
  return ROMAN_TOKEN.test(token) && token in ROMAN_VALUES;
}

/** "ix" -> "9", "x" -> "0" (people use X for zero), "xii" -> "12". */
export function romanToDigits(token: string): string {
  const value = ROMAN_VALUES[token];
  if (value === undefined) return "";
  if (value === 10) return "0"; // X is used as zero far more often than ten
  return String(value);
}
