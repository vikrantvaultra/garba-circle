import { z } from "zod";
import { eq } from "drizzle-orm";
import { fail, guard, json, rateLimit } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authConfigured } from "@/lib/auth/session";
import {
  USERNAME_PATTERN,
  hashPassword,
  normalizeUsername,
  passwordProblem,
} from "@/lib/auth/password";
import { startSessionFor } from "@/lib/auth/sign-in";
import { clientIp } from "@/lib/client-ip";

const Body = z.object({
  username: z.string().max(40),
  password: z.string().max(200),
});

/** Create an account with a username and password, and sign straight in. */
export async function POST(req: Request) {
  return guard(async () => {
    if (!authConfigured()) {
      return fail("Sign-in isn’t set up on this deployment yet. Please try later.", 503);
    }
    // Slows anyone scripting account creation.
    if (!rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
      return fail("Too many new accounts from here. Try again later.", 429);
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail("Choose a username and password.");

    const username = normalizeUsername(parsed.data.username);
    if (!USERNAME_PATTERN.test(username)) {
      return fail("Usernames are 3–20 letters, numbers, dots or underscores.");
    }
    const problem = passwordProblem(parsed.data.password, username);
    if (problem) return fail(problem);

    const passwordHash = await hashPassword(parsed.data.password);
    const [created] = await db
      .insert(users)
      .values({ username, passwordHash })
      .onConflictDoNothing({ target: users.username })
      .returning();
    if (!created) return fail("That username is taken. Try another.", 409);

    const result = await startSessionFor(created);
    if (!result.ok) return fail("This account has been suspended.", 403);
    return json({ ok: true, profileComplete: false });
  });
}

/** Lets the form say a username is taken before they submit. */
export async function GET(req: Request) {
  return guard(async () => {
    if (!rateLimit(`username-check:${clientIp(req)}`, 60, 60 * 1000)) {
      return fail("Slow down a little.", 429);
    }
    const username = normalizeUsername(new URL(req.url).searchParams.get("username") ?? "");
    if (!USERNAME_PATTERN.test(username)) return json({ available: false });
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    return json({ available: !row });
  });
}
