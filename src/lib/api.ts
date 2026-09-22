import { NextResponse } from "next/server";
import { SuspendedError, UnauthorizedError } from "@/lib/auth/session";
import type { User } from "@/lib/db/schema";
import { PaymentConfigError } from "@/lib/payments";

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Wraps a handler so thrown auth/config errors become clean responses. */
export async function guard(
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail("Please sign in again.", 401);
    }
    if (error instanceof SuspendedError) {
      return fail("This account has been suspended.", 403);
    }
    if (error instanceof PaymentConfigError) {
      return fail(error.message, 400);
    }
    console.error("[api]", error);
    const message =
      error instanceof Error && error.message.includes("DATABASE_URL")
        ? error.message
        : "Something went wrong. Please try again.";
    return fail(message, 500);
  }
}

/** Everything about another dancer that is safe to send to the client. */
export type PublicProfile = {
  id: string;
  name: string | null;
  gender: string | null;
  age: number | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  danceStyles: string[];
  skillLevel: string | null;
  avatarUrl: string | null;
};

export function publicProfile(user: User): PublicProfile {
  return {
    id: user.id,
    name: user.name,
    gender: user.gender,
    age: user.age,
    city: user.city,
    state: user.state,
    bio: user.bio,
    danceStyles: user.danceStyles ?? [],
    skillLevel: user.skillLevel,
    avatarUrl: user.avatarUrl,
  };
}

/**
 * Best-effort in-process rate limiting. Fluid Compute reuses instances so this
 * catches the common case of one client hammering an endpoint; the durable
 * limits that actually matter (OTP issuance) are enforced in the database.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
