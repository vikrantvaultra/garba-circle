import { z } from "zod";
import { eq } from "drizzle-orm";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { normalizeIndianMobile } from "@/lib/phone-number";
import { verifyCode } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";

const Body = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().min(4).max(8),
});

const MESSAGES: Record<string, string> = {
  none: "That code has expired. Ask for a new one.",
  expired: "That code has expired. Ask for a new one.",
  wrong: "Wrong code. Check and try again.",
  locked: "Too many wrong tries. Ask for a new code.",
};

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Enter the 6-digit code.");

    const phone = normalizeIndianMobile(parsed.data.phone);
    if (!phone) return fail("Invalid mobile number.");

    if (!rateLimit(`verify:${phone}`, 12, 15 * 60 * 1000)) {
      return fail("Too many attempts. Try again later.", 429);
    }

    const result = await verifyCode(phone, parsed.data.code.trim());
    if (!result.ok) return fail(MESSAGES[result.reason], 400);

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    let user = existing[0];
    if (!user) {
      const [created] = await db.insert(users).values({ phone }).returning();
      user = created;
    } else {
      await db
        .update(users)
        .set({ lastSeenAt: new Date() })
        .where(eq(users.id, user.id));
    }

    if (user.suspendedAt) {
      return fail("This account has been suspended.", 403);
    }

    await createSession(user.id);
    return json({ ok: true, profileComplete: user.profileComplete });
  });
}
