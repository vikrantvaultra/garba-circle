import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";
import { createSession } from "./session";

export type SignInResult =
  | { ok: true; user: User }
  | { ok: false; reason: "suspended" };

/** Finds or creates the dancer for this Google account and starts their session. */
export async function signInWithGoogle(identity: {
  sub: string;
  email: string;
  givenName: string | null;
}): Promise<SignInResult> {
  let [user] = await db.select().from(users).where(eq(users.googleSub, identity.sub)).limit(1);

  if (!user) {
    // Two tabs finishing sign-in at once both land here; the unique index
    // lets one insert win and the other read what it made.
    await db
      .insert(users)
      .values({
        googleSub: identity.sub,
        email: identity.email,
        // A starting point for the setup form, which they can change.
        name: identity.givenName?.slice(0, 60) ?? null,
      })
      .onConflictDoNothing({ target: users.googleSub });
    [user] = await db.select().from(users).where(eq(users.googleSub, identity.sub)).limit(1);
  } else {
    await db
      .update(users)
      .set({ email: identity.email, lastSeenAt: new Date() })
      .where(eq(users.id, user.id));
  }

  if (user.suspendedAt) return { ok: false, reason: "suspended" };

  await createSession(user.id);
  return { ok: true, user };
}

/** Starts a session for an existing dancer, unless they're suspended. */
export async function startSessionFor(user: User): Promise<SignInResult> {
  if (user.suspendedAt) return { ok: false, reason: "suspended" };
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);
  return { ok: true, user };
}

/** Where to send someone once they're signed in. */
export function landingFor(user: User, next: string | null): string {
  if (!user.profileComplete) return "/setup";
  return next ?? "/garba";
}

/** Only same-site paths, so the sign-in link can't bounce people elsewhere. */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }
  if (value.startsWith("/login") || value.startsWith("/api/")) return null;
  return value.slice(0, 200);
}
