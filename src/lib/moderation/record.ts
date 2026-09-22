import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { moderationEvents, users, type User } from "@/lib/db/schema";
import type { ModerationVerdict } from "@/lib/moderation";
import {
  CHAT_BAN_HOURS,
  STRIKES_FOR_CHAT_BAN,
  STRIKES_FOR_SUSPENSION,
} from "@/lib/constants";

/**
 * Persist a blocked message and escalate if this user keeps at it.
 * Returns the sanction applied, so the API can tell them what happened.
 */
export async function recordBlock(input: {
  user: User;
  verdict: ModerationVerdict;
  matchId?: string | null;
  context: "chat" | "profile";
}): Promise<{ strikes: number; chatBannedUntil: Date | null; suspended: boolean }> {
  const { user, verdict } = input;

  const severity =
    verdict.reasonCode === "abuse_severe"
      ? "severe"
      : verdict.reasonCode.startsWith("contact")
        ? "contact"
        : "moderate";

  await db.insert(moderationEvents).values({
    userId: user.id,
    matchId: input.matchId ?? null,
    context: input.context,
    reasonCode: verdict.reasonCode,
    severity,
    // Truncated: enough for a human to judge an appeal, not a full transcript.
    snippet: verdict.snippet,
    matchedTerms: [
      ...verdict.abuse.map((a) => a.term),
      ...verdict.contact.map((c) => c.kind),
    ].slice(0, 8),
  });

  if (!verdict.strike) {
    return {
      strikes: user.strikes,
      chatBannedUntil: user.chatBannedUntil,
      suspended: false,
    };
  }

  const strikes = user.strikes + 1;
  const suspended = strikes >= STRIKES_FOR_SUSPENSION;
  const chatBannedUntil =
    !suspended && strikes >= STRIKES_FOR_CHAT_BAN
      ? new Date(Date.now() + CHAT_BAN_HOURS * 60 * 60 * 1000)
      : user.chatBannedUntil;

  await db
    .update(users)
    .set({
      strikes: sql`${users.strikes} + 1`,
      chatBannedUntil,
      suspendedAt: suspended ? new Date() : user.suspendedAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { strikes, chatBannedUntil, suspended };
}

export function isChatBanned(user: User): boolean {
  return Boolean(
    user.chatBannedUntil && user.chatBannedUntil.getTime() > Date.now(),
  );
}
