import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  chatSessions,
  interests,
  matches,
  users,
  type Match,
  type User,
} from "@/lib/db/schema";

/** Matches store the smaller uuid first so a pair can only exist once. */
export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function findMatchBetween(
  a: string,
  b: string,
): Promise<Match | null> {
  const [userAId, userBId] = orderPair(a, b);
  const rows = await db
    .select()
    .from(matches)
    .where(and(eq(matches.userAId, userAId), eq(matches.userBId, userBId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createMatch(a: string, b: string): Promise<Match> {
  const [userAId, userBId] = orderPair(a, b);
  const [created] = await db
    .insert(matches)
    .values({ userAId, userBId })
    .onConflictDoNothing()
    .returning();

  const match = created ?? (await findMatchBetween(a, b))!;

  // One session row per person: read receipts and the phone-number filter's
  // digit buffer live there.
  await db
    .insert(chatSessions)
    .values([
      { matchId: match.id, userId: userAId },
      { matchId: match.id, userId: userBId },
    ])
    .onConflictDoNothing();

  return match;
}

export type MatchContext = { match: Match; partner: User };

/** Loads a match only if this user is actually in it. */
export async function loadMatchFor(
  userId: string,
  matchId: string,
): Promise<MatchContext | null> {
  const rows = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.id, matchId),
        or(eq(matches.userAId, userId), eq(matches.userBId, userId)),
      ),
    )
    .limit(1);

  const match = rows[0];
  if (!match) return null;

  const partnerId = match.userAId === userId ? match.userBId : match.userAId;
  const [partner] = await db
    .select()
    .from(users)
    .where(eq(users.id, partnerId))
    .limit(1);

  if (!partner) return null;
  return { match, partner };
}

/** Who sent the dandiya that opened this conversation. */
export async function wasInitiatedBy(
  userId: string,
  partnerId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: interests.id })
    .from(interests)
    .where(
      and(eq(interests.fromUserId, userId), eq(interests.toUserId, partnerId)),
    )
    .limit(1);
  return rows.length > 0;
}
