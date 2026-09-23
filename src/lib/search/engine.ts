/**
 * The circle. Picks who the next spin lands on, and keeps the spin economy
 * honest: five free spins, then paid ones. Every spin, free or paid, is
 * filtered by the city and gender the dancer chose.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { spins, users, type User } from "@/lib/db/schema";
import { FREE_SPINS } from "@/lib/constants";

export type SpinQuota = {
  freeRemaining: number;
  paidRemaining: number;
  totalRemaining: number;
  /** True when the free run is over and nothing has been bought yet. */
  needsPack: boolean;
};

export function quotaFor(user: User): SpinQuota {
  const freeRemaining = Math.max(0, FREE_SPINS - user.freeSpinsUsed);
  const paidRemaining = Math.max(0, user.paidSpins);
  return {
    freeRemaining,
    paidRemaining,
    totalRemaining: freeRemaining + paidRemaining,
    needsPack: freeRemaining === 0 && paidRemaining === 0,
  };
}

type CandidateInput = {
  user: User;
  /** null means anyone. */
  gender: "female" | "male" | null;
  city: string;
};

type Row = Record<string, unknown>;

function toUser(row: Row): User {
  return {
    id: row.id as string,
    phone: row.phone as string,
    name: row.name as string | null,
    gender: row.gender as string | null,
    age: row.age as number | null,
    city: row.city as string | null,
    state: row.state as string | null,
    bio: row.bio as string | null,
    danceStyles: (row.dance_styles as string[] | null) ?? null,
    skillLevel: row.skill_level as string | null,
    avatarUrl: row.avatar_url as string | null,
    profileComplete: row.profile_complete as boolean,
    freeSpinsUsed: row.free_spins_used as number,
    paidSpins: row.paid_spins as number,
    strikes: row.strikes as number,
    chatBannedUntil: row.chat_banned_until as Date | null,
    suspendedAt: row.suspended_at as Date | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    lastSeenAt: row.last_seen_at as Date,
  };
}

async function queryCandidate(
  input: CandidateInput,
  excludeRecentlySeen: boolean,
): Promise<User | null> {
  const me = input.user.id;
  const genderClause = input.gender
    ? sql`and u.gender = ${input.gender}`
    : sql``;
  const cityClause = sql`and lower(trim(u.city)) = lower(trim(${input.city}))`;
  const recentClause = excludeRecentlySeen
    ? sql`and not exists (
        select 1 from spins s
        where s.user_id = ${me}::uuid
          and s.shown_user_id = u.id
          and s.created_at > now() - interval '24 hours'
      )`
    : sql``;

  const result = await db.execute(sql`
    select u.*
    from users u
    where u.profile_complete = true
      and u.suspended_at is null
      and u.id <> ${me}::uuid
      ${genderClause}
      ${cityClause}
      and not exists (
        select 1 from blocks b
        where (b.blocker_id = ${me}::uuid and b.blocked_id = u.id)
           or (b.blocker_id = u.id and b.blocked_id = ${me}::uuid)
      )
      and not exists (
        select 1 from matches m
        where m.user_a_id = least(${me}::uuid, u.id)
          and m.user_b_id = greatest(${me}::uuid, u.id)
      )
      and not exists (
        select 1 from interests i
        where i.from_user_id = ${me}::uuid and i.to_user_id = u.id
      )
      ${recentClause}
    order by random()
    limit 1
  `);

  const rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows) ?? [];
  const row = rows[0] as Row | undefined;
  return row ? toUser(row) : null;
}

export async function pickPartner(input: CandidateInput): Promise<User | null> {
  // First try people they have not just seen; if the pool is small, allow
  // repeats rather than telling them the circle is empty.
  return (
    (await queryCandidate(input, true)) ?? (await queryCandidate(input, false))
  );
}

/** Spend one pull: free ones first, then a purchased one. */
export async function consumeSpin(user: User): Promise<{ paid: boolean }> {
  const quota = quotaFor(user);
  if (quota.freeRemaining > 0) {
    await db
      .update(users)
      .set({ freeSpinsUsed: sql`${users.freeSpinsUsed} + 1`, updatedAt: new Date() })
      .where(sql`${users.id} = ${user.id}::uuid`);
    return { paid: false };
  }
  await db
    .update(users)
    .set({ paidSpins: sql`greatest(${users.paidSpins} - 1, 0)`, updatedAt: new Date() })
    .where(sql`${users.id} = ${user.id}::uuid`);
  return { paid: true };
}

export async function recordSpin(input: {
  userId: string;
  shownUserId: string;
  paid: boolean;
  gender?: string | null;
  city?: string | null;
}): Promise<void> {
  await db.insert(spins).values({
    userId: input.userId,
    shownUserId: input.shownUserId,
    paid: input.paid,
    genderFilter: input.gender ?? null,
    cityFilter: input.city ?? null,
  });
}
