import { z } from "zod";
import { eq } from "drizzle-orm";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authConfigured } from "@/lib/auth/session";
import { decoyHash, normalizeUsername, verifyPassword } from "@/lib/auth/password";
import { startSessionFor } from "@/lib/auth/sign-in";
import { clientIp } from "@/lib/client-ip";

const Body = z.object({
  username: z.string().max(40),
  password: z.string().max(200),
});

const WRONG = "Wrong username or password.";

export async function POST(req: Request) {
  return guard(async () => {
    if (!authConfigured()) {
      return fail("Sign-in isn’t set up on this deployment yet. Please try later.", 503);
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Enter your username and password.");
    const username = normalizeUsername(parsed.data.username);

    // Per account, against guessing one person's password; per IP, against
    // trying one common password on many accounts.
    if (
      !rateLimit(`login:${username}`, 10, 15 * 60 * 1000) ||
      !rateLimit(`login-ip:${clientIp(req)}`, 30, 15 * 60 * 1000)
    ) {
      return fail("Too many attempts. Try again in a few minutes.", 429);
    }

    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await decoyHash()));
    if (!user || !user.passwordHash || !ok) return fail(WRONG, 401);

    const result = await startSessionFor(user);
    if (!result.ok) return fail("This account has been suspended.", 403);
    return json({ ok: true, profileComplete: user.profileComplete });
  });
}
