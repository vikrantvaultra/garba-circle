/**
 * The chat meter.
 *
 * The brief: five free minutes "when users are actively chatting", and when
 * they stop, the clock stops with them. So we never bill wall-clock time
 * between two people. Instead the open chat sends a heartbeat every
 * CHAT_HEARTBEAT_SECONDS, and we bill the gap between consecutive heartbeats,
 * capped at CHAT_MAX_TICK_SECONDS. Close the tab, lock the phone, or walk away
 * and the meter stops within one beat — the next beat, hours later, still only
 * costs the cap.
 *
 * Each person has their own meter on a match, so one person running out of
 * time never silences the other.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatSessions, type ChatSession } from "@/lib/db/schema";
import {
  CHAT_HEARTBEAT_SECONDS,
  CHAT_MAX_TICK_SECONDS,
  FREE_CHAT_SECONDS,
} from "@/lib/constants";

export type ChatMeter = {
  totalSeconds: number;
  consumedSeconds: number;
  remainingSeconds: number;
  freeSecondsLeft: number;
  purchasedSeconds: number;
  locked: boolean;
  /** True while the free allowance is still being spent. */
  onFreeTime: boolean;
  heartbeatSeconds: number;
};

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

export function meterFrom(session: ChatSession): ChatMeter {
  const total = FREE_CHAT_SECONDS + session.purchasedSeconds;
  const consumed = Math.min(session.consumedSeconds, total);
  const remaining = Math.max(0, total - consumed);
  return {
    totalSeconds: total,
    consumedSeconds: consumed,
    remainingSeconds: remaining,
    freeSecondsLeft: Math.max(0, FREE_CHAT_SECONDS - session.consumedSeconds),
    purchasedSeconds: session.purchasedSeconds,
    locked: remaining <= 0,
    onFreeTime: session.consumedSeconds < FREE_CHAT_SECONDS,
    heartbeatSeconds: CHAT_HEARTBEAT_SECONDS,
  };
}

/**
 * Advance the meter by the time since the last heartbeat.
 * `active` is false when the tab is hidden or the person has gone quiet, which
 * re-anchors the clock without charging for the gap.
 */
export async function tickChatSession(input: {
  matchId: string;
  userId: string;
  active: boolean;
}): Promise<ChatMeter> {
  const session = await ensureChatSession(input.matchId, input.userId);
  const now = new Date();

  let billedSeconds = 0;
  if (input.active && session.lastTickAt) {
    const gap = (now.getTime() - session.lastTickAt.getTime()) / 1000;
    billedSeconds = Math.max(0, Math.min(gap, CHAT_MAX_TICK_SECONDS));
  }

  const rounded = Math.round(billedSeconds);

  // Anchor the clock whenever the user is present, including on the very first
  // beat (which bills nothing because there is no previous beat to measure).
  const [updated] = await db
    .update(chatSessions)
    .set({
      consumedSeconds: rounded > 0
        ? sql`${chatSessions.consumedSeconds} + ${rounded}`
        : session.consumedSeconds,
      lastTickAt: input.active ? now : null,
    })
    .where(eq(chatSessions.id, session.id))
    .returning();

  return meterFrom(updated);
}

export async function getMeter(
  matchId: string,
  userId: string,
): Promise<ChatMeter> {
  const session = await ensureChatSession(matchId, userId);
  return meterFrom(session);
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
