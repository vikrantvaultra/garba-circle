import { moderateText } from "../src/lib/moderation";

type Case = { text: string; expect: "allow" | "block"; note: string };

const BLOCK: Case[] = [
  // --- plain numbers -----------------------------------------------------
  { text: "my number is 9876543210", expect: "block", note: "plain 10 digit" },
  { text: "98765 43210", expect: "block", note: "split by space" },
  { text: "9876-543-210", expect: "block", note: "dashes" },
  { text: "9 8 7 6 5 4 3 2 1 0", expect: "block", note: "spaced digits" },
  { text: "+91 98765 43210", expect: "block", note: "country code" },
  { text: "call me 09876543210", expect: "block", note: "leading zero" },
  { text: "98.76.54.32.10", expect: "block", note: "dots" },
  { text: "whatsapp 9876543210", expect: "block", note: "whatsapp" },
  // --- other scripts -----------------------------------------------------
  { text: "मेरा नंबर ९८७६५४३२१० है", expect: "block", note: "devanagari digits" },
  { text: "૯૮૭૬૫૪૩૨૧૦", expect: "block", note: "gujarati digits" },
  { text: "９８７６５４３２１０", expect: "block", note: "fullwidth" },
  { text: "9️⃣8️⃣7️⃣6️⃣5️⃣4️⃣3️⃣2️⃣1️⃣0️⃣", expect: "block", note: "keycap emoji" },
  // --- spelled out -------------------------------------------------------
  { text: "nine eight seven six five four three two one zero", expect: "block", note: "english words" },
  { text: "nau aath saat chhe paanch chaar teen do ek shunya", expect: "block", note: "hindi roman" },
  { text: "नौ आठ सात छह पांच चार तीन दो एक शून्य", expect: "block", note: "hindi devanagari" },
  { text: "nau aath saat saha paach char teen don ek shunya", expect: "block", note: "marathi roman" },
  { text: "nav aath saat chha panch char tran be ek shunya", expect: "block", note: "gujarati roman" },
  { text: "nineeightsevensixfivefourthreetwoonezero", expect: "block", note: "no spaces" },
  { text: "n i n e  e i g h t  s e v e n  s i x  f i v e  f o u r  t h r e e  t w o  o n e  z e r o", expect: "block", note: "letter spaced" },
  // --- roman numerals & tricks -------------------------------------------
  { text: "IX VIII VII VI V IV III II I X", expect: "block", note: "roman numerals" },
  { text: "98765 four three two one zero", expect: "block", note: "mixed digits+words" },
  { text: "double 9 double 8 7 6 5 4 3", expect: "block", note: "double multiplier" },
  { text: "my no is 98765432lo", expect: "block", note: "leet tail" },
  { text: "mera number 98765 hai", expect: "block", note: "partial + intent" },
  // --- off platform ------------------------------------------------------
  { text: "mail me at rahul dot patel at gmail dot com", expect: "block", note: "obfuscated email" },
  { text: "pay me at rahul@okicici", expect: "block", note: "upi id" },
  { text: "follow me @rahulgarba2024", expect: "block", note: "social handle" },
  { text: "insta pe aajao link instagram.com/me", expect: "block", note: "url" },
  { text: "apna number de do na", expect: "block", note: "asking for number" },
  { text: "तुमचा नंबर द्या", expect: "block", note: "marathi ask" },
  // --- abuse -------------------------------------------------------------
  { text: "tu bhenchod hai", expect: "block", note: "hindi severe" },
  { text: "b h e n c h o d", expect: "block", note: "spaced abuse" },
  { text: "bhen@#$chod", expect: "block", note: "symbol separated" },
  { text: "bhenchoooooood", expect: "block", note: "stretched" },
  { text: "M4D4RCH0D", expect: "block", note: "leetspeak" },
  { text: "तू चूतिया है", expect: "block", note: "devanagari abuse" },
  { text: "zavadya kutha aahes", expect: "block", note: "marathi abuse" },
  { text: "tu randi hai kya", expect: "block", note: "short severe word" },
  { text: "send me your nude pics", expect: "block", note: "solicitation" },
  { text: "nangi photo bhejo", expect: "block", note: "hindi solicitation" },
  { text: "kapde utaro video call pe", expect: "block", note: "pattern" },
  { text: "jaan se maar dunga tujhe", expect: "block", note: "threat" },
  { text: "you are such an idiot", expect: "block", note: "moderate insult" },
  // --- second round of evasions ---------------------------------------
  { text: "f u c k you", expect: "block", note: "letter-spaced english" },
  { text: "m a d a r c h o d", expect: "block", note: "letter-spaced hindi" },
  { text: "madar chod sale", expect: "block", note: "split compound" },
  { text: "\u0669\u0668\u0667\u0666\u0665\u0664\u0663\u0662\u0661\u0660", expect: "block", note: "arabic-indic digits" },
  { text: "\u096f\u096e\u096d6543210", expect: "block", note: "mixed script digits" },
  { text: "9\u200b8\u200b7\u200b6\u200b5\u200b4\u200b3\u200b2\u200b1\u200b0", expect: "block", note: "zero-width joined" },
  { text: "nine8seven6five4three2one0", expect: "block", note: "alternating words and digits" },
  { text: "call kar lena 9 8 7 6 5 4 3 2 1 0 pe", expect: "block", note: "digits inside a sentence" },
  { text: "ph: 98765*43210", expect: "block", note: "asterisk separator" },
  { text: "wats app - 98765 43210", expect: "block", note: "misspelled whatsapp" },
  { text: "98765 \u091a\u093e\u0930 \u0924\u0940\u0928 \u0926\u094b \u090f\u0915 \u0936\u0942\u0928\u094d\u092f", expect: "block", note: "digits then devanagari words" },
  { text: "mera insta id de raha hu", expect: "block", note: "offering instagram" },
  // --- links and other platforms ---------------------------------------
  { text: "add me on instagram", expect: "block", note: "named platform" },
  { text: "my insta id is rahul_patel99", expect: "block", note: "insta handle" },
  { text: "ig: rahulp", expect: "block", note: "ig abbreviation" },
  { text: "telegram pe aajao", expect: "block", note: "telegram" },
  { text: "t.me/rahulgarba", expect: "block", note: "telegram link" },
  { text: "snapchat add kar lo", expect: "block", note: "snapchat" },
  { text: "lets talk on discord", expect: "block", note: "discord" },
  { text: "check instagram.com/rahul", expect: "block", note: "instagram url" },
  { text: "instagram dot com slash rahul", expect: "block", note: "obfuscated url" },
  { text: "https://bit.ly/abc", expect: "block", note: "shortened link" },
  { text: "www.mysite.in", expect: "block", note: "bare www link" },
  { text: "find me on facebook", expect: "block", note: "facebook" },
  { text: "fb pe search karo", expect: "block", note: "fb abbreviation" },
  { text: "dm me on insta", expect: "block", note: "dm" },
  { text: "chalo kisi aur app pe baat karte hai", expect: "block", note: "move off platform" },
  { text: "my username is rahul_2024", expect: "block", note: "username" },
  { text: "discord.gg/xyz", expect: "block", note: "discord invite" },
  { text: "linktr.ee/rahul", expect: "block", note: "link aggregator" },
  { text: "@rahul_garba", expect: "block", note: "bare handle" },
  { text: "mail me rahul@gmail.com", expect: "block", note: "email" },
  { text: "\u0907\u0902\u0938\u094d\u091f\u093e\u0917\u094d\u0930\u093e\u092e \u092a\u0947 \u0906\u0913", expect: "block", note: "instagram in devanagari" },
  { text: "signal app pe aao", expect: "block", note: "ambiguous name with app context" },
  { text: "youtube.com/watch?v=abc", expect: "block", note: "youtube link" },
];

const ALLOW: Case[] = [
  { text: "Kem cho! Garba ma avjo", expect: "allow", note: "gujarati greeting" },
  { text: "I am 25 years old", expect: "allow", note: "age" },
  { text: "Lets meet at 7 pm near gate 3", expect: "allow", note: "time" },
  { text: "My pincode is 380015", expect: "allow", note: "pincode 6 digits" },
  { text: "I have been doing garba since 2015", expect: "allow", note: "year" },
  { text: "2023 2024 2025 sab me gaya tha", expect: "allow", note: "year list" },
  { text: "do you want to do garba tonight", expect: "allow", note: "english do" },
  { text: "no problem, be there by 8", expect: "allow", note: "ambiguous words" },
  { text: "chhod do yaar, koi baat nahi", expect: "allow", note: "chhod not gaali" },
  { text: "mere paas 3 chaniya choli hai", expect: "allow", note: "small number" },
  { text: "I am from Bihar and I love garba", expect: "allow", note: "identity word" },
  { text: "kya chakka maara Rohit ne", expect: "allow", note: "cricket six" },
  { text: "Moti aunty ka ghar ke paas", expect: "allow", note: "common name" },
  { text: "pagal hai kya tu, chalo garba karte hai", expect: "allow", note: "mild is allowed" },
  { text: "Aaj raat 9 baje milte hai", expect: "allow", note: "time with 9" },
  { text: "मुझे गरबा बहुत पसंद है", expect: "allow", note: "clean hindi" },
  { text: "माझं नाव सागर आहे", expect: "allow", note: "clean marathi" },
  { text: "Ticket price 500 rupees hai", expect: "allow", note: "price" },
  { text: "Assume you are coming, class of 12", expect: "allow", note: "assume/ass" },
  { text: "I will be at the phone booth", expect: "allow", note: "phone word alone" },
  { text: "Dhol bajne wala hai, aa jao", expect: "allow", note: "clean hinglish" },
  { text: "a b c d e f g", expect: "allow", note: "harmless letter run" },
  { text: "Bobs and Riya are both coming", expect: "allow", note: "collapsed boobs is a name" },
  { text: "match x vs y, x won", expect: "allow", note: "lone x is not xxx" },
  { text: "Round III was the best one", expect: "allow", note: "a single roman numeral" },
  { text: "I got 8 out of 10 in the dance quiz", expect: "allow", note: "scores" },
  { text: "Gate 4, block C, 9 pm", expect: "allow", note: "venue details" },
  { text: "my flat is 402 and gate no 3", expect: "allow", note: "address digits" },
  { text: "network signal nahi aa raha", expect: "allow", note: "signal means reception" },
  { text: "lets meet at the ground", expect: "allow", note: "meet is a plan" },
  { text: "meet me at gate 3 at 9", expect: "allow", note: "meet with a time" },
  { text: "I got 5 instant coffee packets", expect: "allow", note: "instant is not insta" },
  { text: "the dhol line was so long", expect: "allow", note: "line is a queue" },
  { text: "Josh bhai is coming too", expect: "allow", note: "Josh is a name" },
  { text: "imo the best night was day 6", expect: "allow", note: "imo means in my opinion" },
  { text: "my team won the dandiya round", expect: "allow", note: "team is not Teams" },
];

let pass = 0;
const failures: string[] = [];

for (const c of [...BLOCK, ...ALLOW]) {
  const v = moderateText(c.text);
  if (v.action === c.expect) {
    pass++;
  } else {
    failures.push(
      `[${c.expect.toUpperCase()} expected, got ${v.action}] ${c.note}\n    "${c.text}"\n    reason=${v.reasonCode} abuse=${v.abuse.map((a) => a.term).join(",")} contact=${v.contact.map((x) => x.kind).join(",")}`,
    );
  }
}

// The reason matters as much as the verdict: a phone number must never be
// logged as abuse, or the sender takes a strike they did not earn.
const REASONS: { text: string; reason: string; note: string }[] = [
  { text: "IX VIII VII VI V IV III II I X", reason: "contact_phone", note: "roman numerals are a number, not a slur" },
  { text: "9876543210", reason: "contact_phone", note: "plain number" },
  { text: "tu bhenchod hai", reason: "abuse_severe", note: "abuse is abuse" },
  { text: "you are such an idiot", reason: "abuse_moderate", note: "insults are moderate" },
  { text: "apna number de do", reason: "contact_request", note: "asking is a request" },
  { text: "add me on instagram", reason: "contact_platform", note: "platforms get their own reason" },
  { text: "https://bit.ly/abc", reason: "contact_other", note: "a bare link is a link" },
];

for (const c of REASONS) {
  const v = moderateText(c.text);
  if (v.reasonCode === c.reason) pass++;
  else
    failures.push(
      `[reason ${c.reason}, got ${v.reasonCode}] ${c.note}\n    "${c.text}"`,
    );
}

// Blocked contact sharing must not quietly add strikes.
const strikeCheck = moderateText("9876543210");
if (strikeCheck.action === "block" && strikeCheck.strike === false) pass++;
else failures.push("[no strike] a first phone-number slip should not add a strike");

// A number fed through in small spelled-out pieces, which is how the filter
// was actually beaten in testing: short runs were dropped, and a message that
// contributed nothing wiped the buffer.
const FEED = [
  "seven two zero eight",
  "seven six six",
  "eight seven six",
];
let feedCarry = "";
let feedBlocked = false;
for (const part of FEED) {
  const v = moderateText(part, { context: "chat", carryDigits: feedCarry });
  if (v.action === "block") feedBlocked = true;
  else if (v.carry) feedCarry = v.carry;
}
if (feedBlocked) pass++;
else failures.push("[fed number] a number spelled out across 3 messages got through");

// The same attempt, but naming the word "number" — caught on the first message.
const fedWithIntent = moderateText(
  "seven two zero eight this is my number connect with me",
);
if (fedWithIntent.action === "block") pass++;
else failures.push("[spelled + intent] spelled digits beside \"my number\" got through");

// cross-message stitching
const first = moderateText("98765", {});
const second = moderateText("43210", { carryDigits: first.carry });
const stitchOk = first.action === "allow" && second.action === "block";
if (stitchOk) pass++;
else
  failures.push(
    `[cross-message stitch] first=${first.action}/${first.carry} second=${second.action}`,
  );

const total = BLOCK.length + ALLOW.length + REASONS.length + 4;
console.log(`\n  ${pass}/${total} passed\n`);
if (failures.length) {
  console.log("FAILURES:\n");
  for (const f of failures) console.log("  " + f + "\n");
  process.exit(1);
}
