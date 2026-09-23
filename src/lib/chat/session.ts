/**
 * Per-person state on a conversation: when they last read it, and the digit
 * buffer the phone-number filter uses to stitch a number split across
 * messages. Chat itself is free and untimed.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatSessions, type ChatSession } from "@/lib/db/schema";

export async function ensureChatSession(
  matchId: string,
  userId: string,
): Promise<ChatSession> {
  const existing = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.matchId, matchId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(chatSessions)
    .values({ matchId, userId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost the race with a parallel request — read the winner's row.
  const [row] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.matchId, matchId), eq(chatSessions.userId, userId)))
    .limit(1);
  return row;
}

export async function rememberCarryDigits(input: {
  sessionId: string;
  carry: string;
}): Promise<void> {
  await db
    .update(chatSessions)
    .set({
      carryDigits: input.carry || null,
      carryUpdatedAt: input.carry ? new Date() : null,
    })
    .where(eq(chatSessions.id, input.sessionId));
}

/** Fragments older than this are no longer part of the same attempt. */
const CARRY_TTL_MS = 10 * 60 * 1000;

export function usableCarry(session: ChatSession): string {
  if (!session.carryDigits || !session.carryUpdatedAt) return "";
  if (Date.now() - session.carryUpdatedAt.getTime() > CARRY_TTL_MS) return "";
  return session.carryDigits;
}
