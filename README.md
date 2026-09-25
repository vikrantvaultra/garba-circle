# Garba Circle

A Navratri partner-finding app for mobile. Sign in with your number, build a
profile, spin a circle of garba dancers that stops on a real dancer, send a
dandiya, and chat — with phone numbers and abuse blocked at the
door.

Built with Next.js 16 (App Router), Postgres, Drizzle and Tailwind v4.
Deploys to Vercel.

---

## How it works

### The garba map (home)
`/garba` is the home screen, and it is public, so no sign-in is needed. It shows
every Navratri garba we know of on a map: pick a city from the searchable
dropdown, or tap a numbered circle, and the map flies to that city's pins. A
pin or card shows the dates, timings, entry and passes, artists, organiser,
Google Maps directions and the source links.

- **Map:** MapLibre GL on OpenFreeMap's free "liberty" vector style, with no API
  key. Pins cluster into numbered circles. MapLibre 6 loads its tile worker
  by URL, so `postinstall` copies it into `public/maplibre/` (git-ignored).
- **Data:** `src/lib/garba/events.json`, validated against
  `src/lib/garba/schema.ts` when the app starts. Every event lists its source
  URLs. Fields the sources didn't give are null, never guessed. `status` is
  `confirmed-2026` when this year's edition is announced, and `recurring` for
  a garba held every year whose 2026 details aren't out yet.
- **Updating:** research into JSON files in that shape, then
  `npm run garba:import -- a.json b.json ...` validates them, rejects
  duplicates and drops any pin more than 45 km from the rest of its city (a
  geocoder matching a same-named place in another state), then rewrites
  `events.json`.
- **Pins** were geocoded with OpenStreetMap Nominatim. Many venues aren't in
  OSM, so some pins sit on the area or a landmark, and the map says so.

### The circle
Every dancer gets **5 free spins**. Tap the Havmor button in the middle to spin, or
hold it to charge a bigger spin (bigger only in how long it turns — power
never changes who you land on).

Whoever it lands on comes with a compatibility score. It is not random: it
is built in `src/lib/compat.ts` from shared dance styles, same city, same
skill level and closeness in age, and the reason is printed under the
number. Scores of 82+ are a "double-scoop jodi", 96+ a "dandiya soulmate".
"Tonight's jodis" lists everyone the circle landed on since 6 am IST (garba
nights run past midnight), and the streak counts consecutive nights with a
spin — both read from the spins log.

**Every spin starts with two choices: a city and who you'd like to meet**
(women, men or both — "both" applies no gender filter, so dancers who chose
"other" are never hidden). The circle will not spin until both are picked,
and the API refuses a spin without them. Both are free on every spin, free or
paid; a pack only buys more spins. The city dropdown is searchable and shows
how many dancers of the chosen gender are really in each city
(`src/lib/search/cities.ts`), so nobody spins into an empty city blind — and
if they do, the spin is refused and nothing is charged.

Until the free spins run out the app says nothing about prices: no lock icon
and no price list on a first-timer's screen.

| Pack | Price |
|---|---|
| 5 spins | ₹49 |
| Unlimited spins till Dussehra (20 Oct) | ₹99 |

The unlimited pass is a Navratri season pass: every spin is free until 6 am
IST on 21 October 2026, when Dussehra night ends (`UNLIMITED_PASS_ENDS_AT` in
`src/lib/constants.ts`). While it's active nothing counts down, so free or
bought spins are still there afterwards. It can't be bought twice, and it's
taken off sale once the season is over. The old 10-spin pack is retired: it
can no longer be ordered, but an order placed before the change is still
honoured when its payment is confirmed.

### Sending a dandiya

There is no accept step. Sending a dandiya **opens the conversation
immediately** and drops the sender straight into it, so a spin leads to a
message rather than to a queue.

What keeps that safe is everything around it: the spin economy is the rate
limit (five free, then paid), every message passes the moderation engine before
it is stored, and the recipient gets block and report from the very first
screen — the chat opens with "they sent you a dandiya … you can block or
report from the menu, they are never told".

The chat header carries a **Spin again** button that goes straight back to the
circle, with the city and gender already chosen for this browser session.

The Chat tab is a conversation list with unread counts, newest first.
Opening a chat is what marks it read.

### Message notifications
Whoever receives a message is told, whether or not the app is open:

- **App closed or in the background:** a web push notification with the
  sender's name and the message ("Dev Mehta: Aaj raat kaunsa garba?").
  More messages from the same person update one notification with a
  count rather than stacking up, and a tap opens that chat. Nothing is sent
  for a message moderation blocked, and nothing appears while the recipient
  is already reading that chat.
- **App open on another screen:** a banner slides down from the top and
  opens the chat on a tap, and the Chat tab's unread badge updates live.
  This works without push too: the app checks `/api/inbox` every 10 s while
  it is on screen (every 60 s once push is on, since the push wakes it).

The offer to turn notifications on sits at the top of the Chat list, and as a
slim bar in a conversation once you've written something ("Get notified when
Priya replies"). "Not now" hides it for three days. You → **Message
notifications** switches it per device, and signing out stops the device
getting that account's messages.

On iPhone, iOS only gives web push to a site added to the Home Screen and
opened from there (iOS 16.4+), so in Safari the offer explains that instead.
`src/app/manifest.ts` makes the app installable.

Pieces: `public/sw.js` (the service worker: notifications only, no
caching), `src/lib/push` (sending, with dead subscriptions cleaned up),
`src/lib/client/push.ts` (subscribing), `src/components/MessageNotifier.tsx`
(the banner and live badge), and the `push_subscriptions` table. The push is
sent with `after()`, so the sender never waits on it.

### Chat is free
There is no timer on a conversation and nothing to buy for it. Packs only buy
spins. (The old per-person chat meter and its heartbeat endpoint are gone; its
three columns on `chat_sessions` are unused and can be dropped in a migration.)

### Safety
This is the part with the most care in it. See
[Moderation](#moderation-the-interesting-part) below.

---

## Getting started

```bash
npm install
cp .env.example .env.local
npm run db:local               # Postgres 17 in Docker, prints the DATABASE_URL
npm run db:push                # create the tables
npm run db:seed                # 36 sample dancers so the reel has people
npm run dev
```

Generate a session secret with:

```bash
openssl rand -base64 32
```

### Database

Any Postgres works — nothing in the code is provider-specific.

**Locally**, `npm run db:local` runs Postgres 17 in Docker on port 5433.
Nothing is installed system-wide; `npm run db:local:stop` pauses it and
`./scripts/local-db.sh destroy` removes the container and its volume. Open a
shell on it with `npm run db:psql`.

**Hosted**, free tiers worth using: **Neon**, **Supabase**, **Prisma Postgres**.
On Vercel:

```bash
vercel integration add neon    # needs a one-time terms acceptance in the browser
vercel env pull .env.local
```

Use the **pooled** connection string when the provider offers one — the client
sets `prepare: false`, which is what transaction-mode poolers require.

### Signing in locally

With no SMS provider configured, the OTP is printed to the server log and shown
on the login screen. That path is refused in production, so a missing key can
never become a free login.

To go live, set `SMS_PROVIDER=msg91` (cheapest in India) or `twilio` plus the
matching keys in `.env.example`. Indian SMS also needs a DLT-approved template.

### Payments

Without `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` the app uses a simulated
gateway so the whole purchase flow is testable locally. In production, missing
keys are an error rather than a free pack.

With keys set, the flow is: create order server-side → Razorpay Checkout in the
browser (UPI, cards, wallets) → **server-side HMAC signature verification**
before anything is granted. Confirmations are idempotent, so a replayed
callback cannot grant a pack twice.

---

## Moderation (the interesting part)

Two separate engines run on every message, every display name and every bio,
before anything is written to the database. A blocked message is never stored
and never reaches the other person.

### Phone numbers

The requirement was that a number must not get through *in any form*. So rather
than regexing for ten digits, the detector rebuilds the number the way a human
reader would (`src/lib/moderation/`):

- **Every script's numerals** fold to ASCII — Devanagari ०-९, Gujarati ૦-૯,
  Arabic-Indic, Bengali, Tamil, full-width ９, keycap emoji 9️⃣, circled ⑨,
  superscripts.
- **Separators vanish**, so `98765 43210`, `9-8-7-6-5-4-3-2-1-0` and
  `98.76.54.32.10` are all one ten-digit run.
- **Spelled-out numbers** are read in English, Hindi, Marathi and Gujarati, in
  both the native script and romanised form. `nau aath saat chhe paanch chaar
  teen do ek shunya` is a phone number. So is `नौ आठ सात छह पांच चार तीन दो एक शून्य`.
  Words are matched greedily over the de-spaced text, so `n i n e  e i g h t`
  and `nineeightseven` both resolve.
- **Roman numerals** — `IX VIII VII VI V IV III II I X`.
- **Repeat words** — `double 9 double 8 7 6 5 4 3`.
- **Leetspeak tails** — `98765432lo` becomes `9876543210`, but only when the
  whole adjacent letter block maps to digits, so `9876543 ok` is left alone.
- **Fragments across messages** — send `98765` then `43210` a second later and
  the second message is blocked. Each sender carries a short-lived digit
  buffer, scoped to the conversation and expired after 10 minutes. The buffer
  survives messages that add nothing to it, because "seven two zero eight" /
  "seven six six" / "eight seven six" is how the filter was actually beaten in
  testing — a harmless-looking message in between used to wipe it.
- **Spelled digits beside the word "number"** — three or more spelled-out
  digits next to "number", "whatsapp" or "contact" is blocked on the first
  message, without waiting for the rest to arrive.
- **Asking** is blocked too (`apna number de do`, `तुमचा नंबर द्या`), because
  blocking only the sender stops half of an exchange.
- Also caught: emails including `name at gmail dot com`, UPI IDs, links, and
  social handles.

Equal care went into what is **not** blocked: `I am 25`, `meet at 7 pm`,
pincodes, `since 2015`, `2023 2024 2025`, `do you want to`, `no problem, be
there by 8`.

### Links and other platforms

Nothing may point off Garba Circle. `src/lib/moderation/platforms.ts` blocks:

- **Any link** — `https://`, `www.`, or a bare `something.com` across a wide TLD
  list, including shorteners (`bit.ly`, `linktr.ee`) and invites (`discord.gg`,
  `t.me`, `wa.me`).
- **Obfuscated links** — `instagram dot com slash rahul`, `t (dot) me`,
  `h t t p s : / /` are reassembled before matching.
- **Named apps** — Instagram, WhatsApp, Telegram, Snapchat, Facebook, Discord,
  TikTok, Skype, Viber, WeChat, LinkedIn, Tinder, Bumble, ShareChat and more,
  in Latin, Devanagari and Gujarati script, plus the abbreviations people
  actually type: `ig`, `fb`, `wa`, `tg`, `dm`, `snap`.
- **Handles** — `@rahul_garba`, `my username is …`, `id: …`.
- **Invitations to leave** — "chalo kisi aur app pe baat karte hai".

Merely naming a platform is enough; "I saw your Instagram reel" is blocked too.
That is deliberate, and the strictness is spent carefully. Names that double as
ordinary words — **signal** (network signal), **line**, **meet**, **hike**,
**Josh** (a common name), **imo** (in my opinion), **teams** — only count when
an app-ish word sits within a word or two of them. "Network signal nahi aa
raha" and "lets meet at the ground" both pass.

### Abusive language

A tiered lexicon covering English, Hindi, Marathi and Gujarati in both scripts,
matched against four normalised views of the text so that stretched letters
(`bhenchoooood`), separators (`b.h.e.n.c.h.o.d`, `b h e n c h o d`), symbol
padding (`bhen@#$chod`) and leetspeak (`M4D4RCH0D`) all collapse to the same
thing. Phrase patterns catch sexual solicitation and threats, which read as
ordinary words one at a time.

- **Severe** — blocked, and the sender takes a strike. 3 strikes pauses chat for
  24 hours; 6 suspends the account.
- **Moderate** — blocked with a nudge, no strike.
- **Mild** — allowed and logged. `pagal hai kya` is usually affection.

The lexicon deliberately leaves out demonyms and identity words (`bihari`,
`kinnar`), names that double as slurs (`kali`, `moti`, `pandu`) and cricket
slang (`chakka` — a six). Blocking someone for saying where they are from is a
worse failure than missing one insult; those go to human review via the report
button instead.

### Running the tests

```bash
npm run test:moderation   # 125 cases, pure functions, no database needed
npm run test:e2e          # 68 cases against a running dev server
```

`test:moderation` covers every evasion above plus the false-positive guards,
and asserts the *reason* a message was blocked — a phone number logged as abuse
would cost the sender a strike they did not earn.

`test:e2e` signs up two dancers against a live server, spends the five free
spins, hits the paywall, buys a pack, opens a chat with a dandiya, checks the
unread badge from the other side, then walks the whole moderation and
escalation ladder. It resets its own test account, so it is safe
to re-run:

```bash
npm run db:local
DOTENV_CONFIG_PATH=.env.local BASE=http://127.0.0.1:3000 \
  npx tsx -r dotenv/config scripts/e2e.ts
```

---

## Project layout

```
src/
  app/
    page.tsx                 landing
    garba/                   the garba map (home)
    login/                   phone + OTP
    setup/                   3-step profile wizard
    spin/                    the circle
    matches/                 invites and matches
    chat/[matchId]/          chat, free and untimed
    profile/
    api/                     route handlers
  components/                circle/ (Wheel, MatchSheet, PetalBurst), Sheet, PackSheet, …
  lib/
    moderation/              normalize · numbers · phone · abuse · lexicon
    chat/session.ts          read receipts and the split-number buffer
    search/engine.ts         candidate selection and the spin economy
    garba/                   garba events data, schema and loaders
    payments/                Razorpay orders and verification
    push/                    web push for new messages
    db/schema.ts             12 tables
```

## Deploying

```bash
vercel                       # preview
vercel --prod                # production
```

Before the first deploy, set these on the Vercel project:

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | everything |
| `AUTH_SECRET` | sessions and OTP hashing |
| `SMS_PROVIDER` + provider keys | real OTP delivery (production refuses the console transport) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | real payments (production refuses the simulated gateway) |
| `BLOB_READ_WRITE_TOKEN` | optional — avatars as files instead of data URLs |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | message notifications. Generate a pair with `npx web-push generate-vapid-keys`. Without them the app never offers notifications (the in-app banner still works) |
| `VAPID_SUBJECT` | a contact for the push services, e.g. `mailto:you@yourdomain.com`. Apple rejects `localhost` addresses |

Then run `npm run db:push` with `DATABASE_URL` pointing at the production
database.

### Demo shortcuts

A deployment with no SMS provider and no Razorpay keys cannot be signed into or
bought from, which makes it impossible to show anyone. Two env vars relax that,
and both are dangerous:

| Variable | What it does |
|---|---|
| `ALLOW_DEV_OTP=true` | Returns the sign-in code in the API response instead of sending an SMS. **Anyone can then sign in as any phone number.** |
| `ALLOW_DEV_PAYMENTS=true` | Approves purchases without charging. |

They are on automatically in local development and do nothing in production
unless explicitly set. When either is live on a deployment, every page carries
a red DEMO banner so it cannot be mistaken for a launch.

Before real users touch the site:

```bash
vercel env rm ALLOW_DEV_OTP production
vercel env rm ALLOW_DEV_PAYMENTS production
vercel env add SMS_PROVIDER production        # msg91
vercel env add MSG91_AUTH_KEY production
vercel env add MSG91_TEMPLATE_ID production
vercel env add RAZORPAY_KEY_ID production
vercel env add RAZORPAY_KEY_SECRET production
vercel --prod
```

## On engagement, and where the line is

The app is built to be genuinely compelling: a circle that feels good to throw,
synthesised dhol and chimes, haptics, a petal burst on landing, and a live line above the circle
showing how many dancers are in the circle and where jodis are forming.

Every number in that strip is a real query. There is no invented "247 people
viewing", no countdown that quietly resets, no urgency that does not exist. The
recent-match ticker names a city and a time but never a person. When the circle
is quiet it says so — "be the first jodi in Surat tonight" — because social
proof that can be caught lying is worth less than none.

The same applies to money. Prices are shown before checkout, the unit price and
the saving are arithmetic, purchases are one-time with no auto-renewal, and
chatting costs nothing.

## Notes

- Mobile-first throughout: 460px shell, safe-area insets, 16px minimum input
  font so iOS never zooms on focus, and touch targets at 44px and up.
- Avatars are cropped and re-encoded to WebP in the browser (~30 KB) before
  upload. With `BLOB_READ_WRITE_TOKEN` they go to Vercel Blob; without it they
  are stored as data URLs, so the app runs on a bare free-tier database with no
  object storage at all.
- Image messages are intentionally not supported — a photo of a handwritten
  number would walk straight through a text filter.
- Chat is polled every 2.6s rather than held open on a socket. It is simpler,
  survives mobile networks, and costs nothing on a free tier.
