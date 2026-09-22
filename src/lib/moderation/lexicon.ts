/**
 * Abuse lexicon for Garba Circle.
 *
 * Users type in Hindi, Marathi, Gujarati and English and mix scripts freely
 * ("tu randi hai", "तू चूतिया है"). The matcher in abuse.ts folds leetspeak,
 * stretched letters and separators before testing, so entries are written here
 * in plain form.
 *
 * Two matching modes, and the difference matters:
 *   LONG_*  are matched as substrings, so every entry must be long enough that
 *           a substring hit is never accidental.
 *   WORD_*  are matched whole-token, which is how short terms avoid the
 *           classic "assume contains ass" failure.
 *
 * Deliberately NOT here: demonyms and identity words (bihari, madrasi, kinnar),
 * common names that double as slurs (kali, moti, pandu), and cricket slang
 * (chakka = a six). Blocking a user for saying where they are from or for
 * cheering a six is a worse failure than missing one insult, so those need
 * human review rather than a substring match.
 */

/** Blocks the message AND adds a strike. */
export const LONG_SEVERE: string[] = [
  // English
  "motherfucker", "motherfuk", "fucking", "fucker", "fucked", "fuckoff",
  "asshole", "bastard", "dickhead", "blowjob", "handjob", "bitches",
  "pussy", "cunt", "whore", "slutty", "nudes", "nudepic", "nudephoto",
  "sexchat", "sexting", "masturbat", "cumshot", "orgasm", "hardcore",
  "pornhub", "rapist", "molest", "pedophile", "boobs", "nipple",
  "vagina", "penis", "fingering", "gangbang", "escort", "prostitut",
  "randikhana", "onlyfans",
  // Hindi / Urdu, romanised
  "bhenchod", "behenchod", "bhainchod", "benchod", "bahenchod", "bhenchood",
  "madarchod", "maderchod", "madrchod", "motherchod",
  "bhosdike", "bhosdiwale", "bhosadi", "bhosda", "bhosdi", "bhosad",
  "chutiya", "chutiye", "chutiyap", "chutmarike", "chutmar",
  "chodu", "chudai", "chudwa", "chodne", "chodna", "chodta", "chodti",
  "lavdya", "lavde", "laude", "lauda", "lodu", "loda", "lodo",
  "gandmar", "gandfat", "gaandu", "gandufad", "gandmasti",
  "harami", "haramkhor", "haramzada", "haramzade",
  "kutiya", "kutiye", "kamina", "kaminey", "kameena",
  "chinaal", "chinal", "rakhail", "balatkar", "balatkari",
  "jhantu", "jhaant", "randibaaz",
  // Marathi
  "zavadya", "zavadi", "zavlo", "zavto", "zavnar", "bhikarchot",
  "aaicha ghov", "aaigha", "bhadvya", "bhadava", "bhadva", "sadlela",
  // Gujarati, romanised
  "bhosadina", "lavdo", "lodhu", "gandufa", "randva",
  // Devanagari (Hindi + Marathi)
  "भेनचोद", "बहनचोद", "भोसडी", "भोसड़ी",
  "मादरचोद", "चूतिया", "चुतिया", "चुदाई",
  "गांडू", "गान्डू", "हरामी", "हरामजाद",
  "कुतिया", "बलात्कार", "झवाड्या", "भडव्या",
  "छिनाल", "लवड्या", "कमीना",
  // Gujarati script
  "ભોસડી", "ચૂતિયા", "લોડો", "ગાંડુ",
];

/**
 * Short severe terms — whole-token match only.
 * Note what is absent: bare "chod" and "chodi", because "chhod do" (leave it)
 * is typed as "chod do" constantly. The compound forms above carry the intent.
 */
export const WORD_SEVERE: string[] = [
  "fuck", "fuk", "fck", "fuq", "phuck", "fucc", "bitch", "slut", "dick",
  "cock", "cunt", "rape", "nude", "porn", "xxx", "horny", "wank", "tits",
  "boob", "milf", "randi", "randee", "rand", "chut", "chuth", "lund",
  "lavda", "laund", "gandu", "gaand", "gand", "bkl", "mkc", "bsdk",
  "bhosd", "jhat", "jhant", "zava", "zav", "bhadv", "chinal", "nangi",
  "nanga", "bc", "mc", "mcbc",
  "चूत", "लंड", "रंडी", "गांड", "झव", "नंगी",
  "રંડી", "ચોદ",
];

/** Blocked with a warning, but no strike. Personal insults and harassment. */
export const LONG_MODERATE: string[] = [
  "bewakoof", "bewkoof", "bewaqoof", "nalayak", "nikamma", "besharam",
  "badtameez", "badsurat", "bhikari", "bhikhari", "ghatiya", "gawar",
  "ganwar", "chapri", "chindi", "stupid", "idiot", "moron", "loser",
  "disgusting", "pathetic", "retarded", "worthless", "shutup", "getlost",
  "murkha", "vedya", "bavlat", "sexy", "sexual",
  "मूर्ख", "बेशरम", "बेवकूफ", "घटिया", "नालायक",
];

export const WORD_MODERATE: string[] = [
  "kutta", "kutte", "kutti", "gadha", "gadhe", "ullu", "suar", "sooar",
  "sex", "dumb", "fatso", "ugly", "yeda", "saali", "sali",
  "कुत्ता", "गधा", "साली",
];

/**
 * Logged but allowed. These are everyday exasperation in Indian chat —
 * "pagal hai kya" is usually affection. We count them so a user who does
 * nothing but sling mild abuse still surfaces for review.
 */
export const WORD_MILD: string[] = [
  "pagal", "paagal", "faltu", "bakwas", "bakwaas", "damn", "crap", "shit",
  "sala", "salaa", "dhakkan", "nautanki", "chup", "पागल", "साला",
];

/**
 * Phrases, not words. Sexual solicitation and threats read as ordinary words
 * one at a time and only become visible at the phrase level.
 */
export const SEVERE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(send|bhej|bhejo|share|show|dikha|dikhao|mokal)\b[^.!?]{0,28}\b(nude|nangi|nanga|bra|panty|boob|chest|body|figure|without clothes)\b/, label: "sexual solicitation" },
  { re: /\b(nude|nangi|nanga|bra|panty|boob)\b[^.!?]{0,28}\b(send|bhej|bhejo|share|show|dikha|dikhao|photo|pic|image)\b/, label: "sexual solicitation" },
  { re: /\b(video|vc|v\/c)\s?call\b[^.!?]{0,28}\b(nude|nangi|alone|akela|akeli|private|raat|night|band|bina)\b/, label: "sexual solicitation" },
  { re: /\b(kapde|clothes|dress|kapda)\b[^.!?]{0,20}\b(utar|utaro|utaar|remove|kholo|khol|kadh)\b/, label: "sexual solicitation" },
  { re: /\b(so|sona|soyi|soja|sleep)\b[^.!?]{0,16}\b(mere sath|mere saath|majhya sobat|with me)\b/, label: "sexual solicitation" },
  { re: /\b(hotel|room|oyo|flat)\b[^.!?]{0,22}\b(chal|chalo|chalte|aaja|aa ja|book|night|raat)\b/, label: "sexual solicitation" },
  { re: /\b(jaan se|zinda|zindaa)\b[^.!?]{0,18}\b(maar|marunga|marenge|nahi|nai)\b/, label: "threat" },
  { re: /\b(dekh lunga|dekh lenge|dekh leta hu|chhodunga nahi|chodunga nahi|barbaad kar)\b/, label: "threat" },
  { re: /\b(acid|tezaab|chaku|knife|goli|gun)\b[^.!?]{0,18}\b(dalunga|daal|maar|marunga|dikha|chala)\b/, label: "threat" },
  { re: /\b(tera|teri|tumhara|tumcha|tamaru)\b[^.!?]{0,14}\b(address|ghar|pata|gaav)\b[^.!?]{0,18}\b(pata hai|mil jayega|dhundh|aa raha|pahunch)\b/, label: "threat" },
];

/** Unambiguous slurs only. Anything context-dependent is left to reporting. */
export const LONG_SLURS: string[] = [
  "bhangi", "chamar", "chuhra", "mleccha", "nigger", "nigga", "chinki",
  "raghead", "jihadi", "katwa", "harijan", "dhed",
];
