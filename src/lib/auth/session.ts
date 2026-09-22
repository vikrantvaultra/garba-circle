import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type User } from "@/lib/db/schema";

const COOKIE = "gc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 24) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Generate one with: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const id = await getUserId();
  if (!id) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Thrown by requireUser and turned into a 401 by withUser. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (user.suspendedAt) throw new SuspendedError();
  return user;
}

export class SuspendedError extends Error {
  constructor() {
    super("Account suspended");
  }
}
