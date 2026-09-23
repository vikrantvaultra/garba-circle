/**
 * End-to-end smoke test: signs up two dancers, spends the free spins, buys a
 * pack, matches them, then tries every kind of message the filters exist to
 * stop. Run against a dev server:
 *
 *   BASE=http://127.0.0.1:3001 npx tsx scripts/e2e.ts
 */

const BASE = process.env.BASE ?? "http://127.0.0.1:3001";

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Session {
  cookie = "";

  async call(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<{ status: number; data: Record<string, unknown> }> {
    const res = await fetch(BASE + path, {
      method: options.method ?? "GET",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0];

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 200) };
    }
    return { status: res.status, data };
  }

  async signIn(localNumber: string): Promise<boolean> {
    const otp = await this.call("/api/auth/request-otp", {
      method: "POST",
      body: { phone: localNumber },
    });
    const code = otp.data.devCode as string | undefined;
    if (!code) {
      console.log("    request-otp:", otp.status, JSON.stringify(otp.data).slice(0, 160));
      return false;
    }
    const verify = await this.call("/api/auth/verify-otp", {
      method: "POST",
      body: { phone: localNumber, code },
    });
    return verify.status === 200;
  }
}

async function main() {
  // Re-runnable: drop the test account so strikes, spins and matches from
  // a previous run cannot change the outcome. Foreign keys cascade the rest.
  await resetTestAccount("919820011111");

  console.log(`\nGarba Circle end-to-end  —  ${BASE}\n`);

  // -- sign in ------------------------------------------------------------
  console.log("Auth");
  const a = new Session();
  check("dancer A signs in with an OTP", await a.signIn("9820011111"));

  const me = await a.call("/api/me");
  check("new account starts unfinished", me.data.signedIn === true &&
    (me.data.user as Record<string, unknown>)?.profileComplete === false);
  check(
    "new account has 5 free spins",
    (me.data.quota as Record<string, unknown>)?.freeRemaining === 5,
  );

  const badOtp = await a.call("/api/auth/verify-otp", {
    method: "POST",
    body: { phone: "9820011112", code: "000000" },
  });
  check("a wrong code is rejected", badOtp.status === 400);

  // -- profile ------------------------------------------------------------
  console.log("\nProfile");
  const profile = await a.call("/api/profile", {
    method: "PUT",
    body: {
      name: "Vikrant",
      gender: "male",
      age: 27,
      city: "Mumbai",
      state: "Maharashtra",
      bio: "Raas till 2am, chai after.",
      danceStyles: ["Garba", "Dandiya Raas"],
      skillLevel: "intermediate",
    },
  });
  check("profile saves", profile.status === 200);

  const dirtyBio = await a.call("/api/profile", {
    method: "PUT",
    body: {
      name: "Vikrant",
      gender: "male",
      age: 27,
      city: "Mumbai",
      bio: "call me on 9876543210",
      danceStyles: ["Garba"],
      skillLevel: "pro",
    },
  });
  check("a phone number in the bio is rejected", dirtyBio.status === 400);

  // -- the free spins -----------------------------------------------------
  console.log("\nSpins");
  const seen: string[] = [];

  // Where and who are required on every spin, and nothing is charged
  // for asking without them.
  const bare = await a.call("/api/search/spin", { method: "POST", body: {} });
  const noGender = await a.call("/api/search/spin", {
    method: "POST",
    body: { city: "Pune" },
  });
  const noCity = await a.call("/api/search/spin", {
    method: "POST",
    body: { gender: "both", city: "  " },
  });
  const afterRefused = await a.call("/api/me");
  check(
    "a spin without a city and gender is refused, and costs nothing",
    bare.status === 400 &&
      bare.data.needsFilters === true &&
      noGender.status === 400 &&
      noCity.status === 400 &&
      (afterRefused.data.quota as Record<string, number>)?.freeRemaining === 5,
  );

  for (const [i, city] of ["Pune", "Bengaluru", "Jaipur"].entries()) {
    const spin = await a.call("/api/search/spin", {
      method: "POST",
      body: { gender: "both", city },
    });
    if (spin.status === 200) seen.push((spin.data.partner as Record<string, string>).id);
    check(
      `free spin ${i + 1} lands on someone in ${city}`,
      spin.status === 200 &&
        spin.data.genderFilterApplied === false &&
        (spin.data.partner as Record<string, string>)?.city === city,
      spin.status !== 200 ? JSON.stringify(spin.data).slice(0, 120) : "",
    );
  }

  const freeCity = await a.call("/api/search/spin", {
    method: "POST",
    body: { gender: "both", city: "Surat" },
  });
  if (freeCity.status === 200) seen.push((freeCity.data.partner as Record<string, string>).id);
  check(
    "a FREE spin honours the city filter",
    freeCity.status === 200 &&
      freeCity.data.cityFilterApplied === true &&
      (freeCity.data.partner as Record<string, string>)?.city === "Surat",
    freeCity.status !== 200 ? JSON.stringify(freeCity.data).slice(0, 140) : "",
  );

  const emptyCity = await a.call("/api/search/spin", {
    method: "POST",
    body: { gender: "female", city: "Delhi" },
  });
  check(
    "a city with nobody of that gender says so and charges nothing",
    emptyCity.status === 404 && emptyCity.data.charged === false,
  );

  // Gender is free too: a free spin must honour it.
  const freeGender = await a.call("/api/search/spin", {
    method: "POST",
    body: { gender: "male", city: "Delhi" },
  });
  if (freeGender.status === 200) seen.push((freeGender.data.partner as Record<string, string>).id);
  check(
    "a FREE spin honours the gender filter",
    freeGender.status === 200 &&
      freeGender.data.genderFilterApplied === true &&
      (freeGender.data.partner as Record<string, string>)?.gender === "male",
    freeGender.status !== 200 ? JSON.stringify(freeGender.data).slice(0, 140) : "",
  );


  check("free spins never repeat a dancer", new Set(seen).size === seen.length);

  const sixth = await a.call("/api/search/spin", {
    method: "POST",
    body: { gender: "both", city: "Pune" },
  });
  check(
    "the 6th spin is paywalled",
    sixth.status === 402 && sixth.data.needsPack === true,
  );

  // -- buying spins -------------------------------------------------------
  console.log("\nPayments");
  const order = await a.call("/api/payments/create-order", {
    method: "POST",
    body: { packKey: "spins_5" },
  });
  check(
    "a ₹21 order is created",
    order.status === 200 && (order.data.pack as Record<string, number>)?.amountPaise === 2100,
  );

  const confirm = await a.call("/api/payments/confirm", {
    method: "POST",
    body: { paymentId: order.data.paymentId },
  });
  check(
    "confirming grants 5 spins",
    confirm.status === 200 &&
      (confirm.data.quota as Record<string, number>)?.paidRemaining === 5,
  );

  const replay = await a.call("/api/payments/confirm", {
    method: "POST",
    body: { paymentId: order.data.paymentId },
  });
  const afterReplay = await a.call("/api/me");
  check(
    "replaying a confirmation does not grant twice",
    replay.status === 200 &&
      (afterReplay.data.quota as Record<string, number>)?.paidRemaining === 5,
  );

  const paidSpin = await a.call("/api/search/spin", {
    method: "POST",
    body: { gender: "female", city: "Surat" },
  });
  check(
    "a PAID spin honours gender as well as city",
    paidSpin.status === 200 &&
      paidSpin.data.genderFilterApplied === true &&
      paidSpin.data.cityFilterApplied === true &&
      (paidSpin.data.partner as Record<string, string>)?.gender === "female" &&
      (paidSpin.data.partner as Record<string, string>)?.city === "Surat",
    paidSpin.status !== 200 ? JSON.stringify(paidSpin.data).slice(0, 140) : "",
  );

  const partner = paidSpin.data.partner as Record<string, string>;

  // -- matching -----------------------------------------------------------
  console.log("\nMessaging");
  const dandiya = await a.call("/api/interest", {
    method: "POST",
    body: { toUserId: partner.id },
  });
  const matchId = dandiya.data.matchId as string;
  check(
    "sending a dandiya opens a chat immediately",
    dandiya.status === 200 && Boolean(matchId),
    JSON.stringify(dandiya.data).slice(0, 120),
  );

  const chat = await a.call(`/api/chat/${matchId}`);
  check(
    "the chat opens with no meter: chatting is free",
    chat.status === 200 && chat.data.meter === undefined,
  );

  const hello = await a.call(`/api/chat/${matchId}/messages`, {
    method: "POST",
    body: { body: "Kem cho! Aaj raat kya plan hai?" },
  });
  check(
    "A can message straight away, with no accept step",
    hello.status === 200,
  );

  const b = new Session();
  const partnerPhone = await lookupPhone(partner.id);
  check("B signs in", await b.signIn(partnerPhone));

  const inbox = await b.call("/api/matches");
  const conversations =
    (inbox.data.conversations as Record<string, unknown>[]) ?? [];
  const thread = conversations.find((c) => c.matchId === matchId);
  check("B sees the conversation waiting", Boolean(thread));
  check(
    "B sees it as unread, and as one they did not start",
    Number(thread?.unread ?? 0) >= 1 && thread?.initiatedByMe === false,
    `unread=${thread?.unread} initiatedByMe=${thread?.initiatedByMe}`,
  );
  check(
    "the preview shows A's message",
    (thread?.lastMessage as Record<string, unknown>)?.body ===
      "Kem cho! Aaj raat kya plan hai?",
  );

  const bSees = await b.call(`/api/chat/${matchId}/messages`);
  check(
    "B receives it",
    ((bSees.data.messages as Record<string, unknown>[]) ?? []).some(
      (m) => m.body === "Kem cho! Aaj raat kya plan hai?" && m.mine === false,
    ),
  );

  const afterRead = await b.call("/api/matches");
  const readThread = (
    (afterRead.data.conversations as Record<string, unknown>[]) ?? []
  ).find((c) => c.matchId === matchId);
  check(
    "opening the chat clears the unread badge",
    Number(readThread?.unread ?? -1) === 0,
    `unread=${readThread?.unread}`,
  );

  console.log("\nModeration");

  // Ordinary language first, while the account is still spotless.
  const allowed: [string, string][] = [
    ["I am 27, doing garba since 2015", "ages and years"],
    ["Meet at gate 3 around 9 pm", "a time and a gate"],
    ["chhod do yaar, koi baat nahi", "chhod is not a gaali"],
    ["pagal hai kya, chalo garba karte hai", "mild affection"],
    ["Round III was the best, match x vs y", "roman numerals and a lone x"],
    ["network signal nahi aa raha yaar", "signal means reception"],
    ["lets meet at the ground near gate 3", "meet is a plan, not an app"],
  ];

  for (const [text, label] of allowed) {
    await pause(430);
    const res = await a.call(`/api/chat/${matchId}/messages`, {
      method: "POST",
      body: { body: text },
    });
    check(
      `allowed: ${label}`,
      res.status === 200,
      res.status !== 200 ? `got ${res.status}: ${JSON.stringify(res.data).slice(0, 110)}` : "",
    );
  }

  // Contact sharing is blocked but does not cost a strike on its own.
  const contactBlocked: [string, string][] = [
    ["9876543210", "a plain 10-digit number"],
    ["mera number 98765 43210 hai", "a number split by a space"],
    ["nau aath saat chhe paanch chaar teen do ek shunya", "a number spelled in Hindi"],
    ["\u0928\u094c \u0906\u0920 \u0938\u093e\u0924 \u091b\u0939 \u092a\u093e\u0902\u091a \u091a\u093e\u0930 \u0924\u0940\u0928 \u0926\u094b \u090f\u0915 \u0936\u0942\u0928\u094d\u092f", "a number spelled in Devanagari"],
    ["IX VIII VII VI V IV III II I X", "roman numerals"],
    ["\u0669\u0668\u0667\u0666\u0665\u0664\u0663\u0662\u0661\u0660", "Arabic-Indic numerals"],
    ["9\u200b8\u200b7\u200b6\u200b5\u200b4\u200b3\u200b2\u200b1\u200b0", "zero-width separated digits"],
    ["double 9 double 8 7 6 5 4 3", "double-word digits"],
    ["apna whatsapp number de do na", "asking for a number"],
    ["mail me at rahul dot patel at gmail dot com", "an obfuscated email"],
    ["pay me at rahul@okicici", "a UPI id"],
    ["add me on instagram", "an Instagram invite"],
    ["telegram pe aajao", "a Telegram invite"],
    ["check instagram.com/rahul", "a profile link"],
    ["https://bit.ly/abc", "a shortened link"],
    ["chalo kisi aur app pe baat karte hai", "moving the chat off-platform"],
    ["@rahul_garba", "a bare handle"],
  ];

  for (const [text, label] of contactBlocked) {
    await pause(430);
    const res = await a.call(`/api/chat/${matchId}/messages`, {
      method: "POST",
      body: { body: text },
    });
    check(
      `blocked: ${label}`,
      res.status === 422 && String(res.data.reasonCode ?? "").startsWith("contact"),
      res.status !== 422 ? `got ${res.status}` : `reason ${res.data.reasonCode}`,
    );
  }

  const cleanRecord = await a.call("/api/me");
  check(
    "sharing a number never costs a strike on its own",
    (cleanRecord.data.user as Record<string, number>)?.strikes === 0,
    `strikes=${(cleanRecord.data.user as Record<string, number>)?.strikes}`,
  );

  // Splitting a number across two messages does cost a strike.
  await pause(430);
  const frag1 = await a.call(`/api/chat/${matchId}/messages`, {
    method: "POST",
    body: { body: "98765" },
  });
  await pause(430);
  const frag2 = await a.call(`/api/chat/${matchId}/messages`, {
    method: "POST",
    body: { body: "43210" },
  });
  check(
    "a number split across two messages is caught on the second",
    frag1.status === 200 && frag2.status === 422,
    `first=${frag1.status} second=${frag2.status}`,
  );

  // Abuse is severe: each one costs a strike, and three pause the account.
  const abusive: [string, string][] = [
    ["tu bhenchod hai", "Hindi abuse"],
    ["m a d a r c h o d", "letter-spaced abuse"],
    ["zavadya kutha aahes", "Marathi abuse"],
    ["nangi photo bhejo", "sexual solicitation"],
  ];

  let banSeen = false;
  for (const [text, label] of abusive) {
    await pause(430);
    const res = await a.call(`/api/chat/${matchId}/messages`, {
      method: "POST",
      body: { body: text },
    });
    if (res.status === 403) banSeen = true;
    check(
      `blocked: ${label}`,
      res.status === 422 || res.status === 403,
      `got ${res.status}`,
    );
  }

  const record = await a.call("/api/me");
  const user = record.data.user as Record<string, number | boolean>;
  check("repeated abuse racks up strikes", (user.strikes as number) >= 3);
  check(
    "three strikes pause chat for the account",
    user.chatBanned === true && banSeen,
    `chatBanned=${user.chatBanned} banSeen=${banSeen}`,
  );

  // -- free chat ---------------------------------------------------------
  console.log("\nFree chat");
  const heartbeat = await a.call(`/api/chat/${matchId}/heartbeat`, {
    method: "POST",
    body: { active: true },
  });
  check("there is no heartbeat meter any more", heartbeat.status === 404);

  const chatPack = await a.call("/api/payments/create-order", {
    method: "POST",
    body: { packKey: "chat_10" },
  });
  check("chat time can no longer be bought", chatPack.status === 400);

  const bReply = await b.call(`/api/chat/${matchId}/messages`, {
    method: "POST",
    body: { body: "Main Surat mein, United Way garba!" },
  });
  check(
    "the other side replies with no time limit and no meter in the response",
    bReply.status === 200 && bReply.data.meter === undefined,
    `got ${bReply.status}`,
  );

  // -- safety -------------------------------------------------------------
  console.log("\nSafety");
  const report = await a.call("/api/report", {
    method: "POST",
    body: { reportedId: partner.id, matchId, reason: "asking_contact" },
  });
  check("reporting works", report.status === 200);

  const blockRes = await a.call("/api/block", {
    method: "POST",
    body: { blockedId: partner.id, blocked: true },
  });
  check("blocking works", blockRes.status === 200);

  await pause(430);
  const afterBlock = await a.call(`/api/chat/${matchId}/messages`, {
    method: "POST",
    body: { body: "hello again" },
  });
  check("a blocked chat refuses messages", afterBlock.status === 403);

  const listAfterBlock = await a.call("/api/matches");
  check(
    "a blocked dancer disappears from the list",
    ((listAfterBlock.data.matches as Record<string, unknown>[]) ?? []).every(
      (m) => (m.partner as Record<string, string>).id !== partner.id,
    ),
  );

  const stranger = await b.call(`/api/chat/${matchId}`);
  check("the other side can still open the chat", stranger.status === 200);

  // -- summary ------------------------------------------------------------
  const total = passed + failures.length;
  console.log(`\n  ${passed}/${total} passed\n`);
  if (failures.length) {
    console.log("FAILURES:");
    for (const f of failures) console.log("  • " + f);
    process.exit(1);
  }
}

async function resetTestAccount(storedPhone: string): Promise<void> {
  const { db } = await import("../src/lib/db");
  const { users, otpCodes } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.delete(users).where(eq(users.phone, storedPhone));
  // otp_codes is keyed by phone, not by user, so it outlives the account and
  // would otherwise trip the resend cooldown on the next run. The seeded
  // dancers need the same treatment: the test signs in as whichever one the
  // reel landed on, and back-to-back runs would hit that cooldown.
  const { sql } = await import("drizzle-orm");
  await db.delete(otpCodes).where(eq(otpCodes.phone, storedPhone));
  await db.delete(otpCodes).where(sql`phone like '9170000%'`);
}

/** The seeded dancers' phone numbers are only in the database. */
async function lookupPhone(userId: string): Promise<string> {
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select({ phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row.phone.replace(/^91/, "");
}

main()
  // The Postgres pool keeps the event loop alive, so exit deliberately.
  .then(() => process.exit(failures.length ? 1 : 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
