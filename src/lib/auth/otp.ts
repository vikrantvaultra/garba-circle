import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { otpCodes } from "@/lib/db/schema";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
} from "@/lib/constants";

function hashCode(phone: string, code: string): string {
  const pepper = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${phone}:${code}:${pepper}`).digest("hex");
}

export function generateCode(): string {
  // randomInt is cryptographically sound; Math.random is not.
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

export async function secondsUntilResendAllowed(phone: string): Promise<number> {
  const [recent] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!recent) return 0;
  const elapsed = (Date.now() - recent.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}

/** How many codes were requested for this number in the last hour. */
export async function recentRequestCount(phone: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phone, phone),
        gt(otpCodes.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    );
  return row?.count ?? 0;
}

export async function issueCode(phone: string): Promise<string> {
  const code = generateCode();
  await db.insert(otpCodes).values({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
  });
  return code;
}

export type VerifyResult =
  | { ok: true; codeId: string }
  | { ok: false; reason: "expired" | "wrong" | "locked" | "none" };

/**
 * Checks a code and uses it up in one step, so two requests racing with the
 * same code can't both sign in. If sign-in then fails for a reason that
 * isn't the dancer's (the database, the session), hand it back with
 * `releaseCode` so a retry works instead of reporting the code expired.
 */
export async function verifyCode(
  phone: string,
  code: string,
): Promise<VerifyResult> {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: "none" };
  if (row.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  if (row.codeHash !== hashCode(phone, code)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id));
    return { ok: false, reason: "wrong" };
  }

  const used = await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.id, row.id), isNull(otpCodes.consumedAt)))
    .returning({ id: otpCodes.id });
  // Another request used it first.
  if (used.length === 0) return { ok: false, reason: "none" };
  return { ok: true, codeId: row.id };
}

/** Makes a used code valid again, after a sign-in that failed on our side. */
export async function releaseCode(codeId: string): Promise<void> {
  await db.update(otpCodes).set({ consumedAt: null }).where(eq(otpCodes.id, codeId));
}
