/**
 * "Tonight's jodis": everyone the circle has landed on for this dancer since
 * the night began, and how many nights in a row they have come back to spin.
 * Both come straight from the spins log.
 */

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { spins, users, type User } from "@/lib/db/schema";
import { publicProfile } from "@/lib/api";
import { compatibility, type Landing } from "@/lib/compat";
import { NIGHT_STARTS_AT_HOUR_IST, nightStart } from "@/lib/navratri";

export type Tonight = {
  /** Newest first, one entry per dancer. */
  landings: Landing[];
  /** Consecutive nights with at least one spin, ending last night. */
  pastStreak: number;
};

type Row = Record<string, unknown>;

export async function tonightFor(me: User): Promise<Tonight> {
  const since = nightStart();

  const rows = await db
    .select({ shown: users })
    .from(spins)
    .innerJoin(users, eq(users.id, spins.shownUserId))
    .where(
      and(
        eq(spins.userId, me.id),
        gte(spins.createdAt, since),
        isNull(users.suspendedAt),
        sql`not exists (
          select 1 from blocks b
          where (b.blocker_id = ${me.id}::uuid and b.blocked_id = ${users.id})
             or (b.blocker_id = ${users.id} and b.blocked_id = ${me.id}::uuid)
        )`,
      ),
    )
    .orderBy(desc(spins.createdAt))
    .limit(60);

  const mine = {
    city: me.city,
    danceStyles: me.danceStyles ?? [],
    skillLevel: me.skillLevel,
    age: me.age,
  };
  const seen = new Set<string>();
  const landings: Landing[] = [];
  for (const { shown } of rows) {
    if (seen.has(shown.id)) continue;
    seen.add(shown.id);
    const profile = publicProfile(shown);
    landings.push({ ...compatibility(mine, profile), profile });
  }

  // Night numbers shift the clock back to 6 am IST, matching nightStart().
  const nightExpr = sql`((${spins.createdAt} at time zone 'Asia/Kolkata') - interval '${sql.raw(String(NIGHT_STARTS_AT_HOUR_IST))} hours')::date`;
  const result = await db.execute(sql`
    select distinct ${nightExpr} as night
    from ${spins}
    where ${spins.userId} = ${me.id}::uuid
      and ${spins.createdAt} < ${since.toISOString()}::timestamptz
      and ${spins.createdAt} > ${since.toISOString()}::timestamptz - interval '60 days'
    order by night desc
  `);
  const nightRows =
    (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows) ?? [];

  let pastStreak = 0;
  const DAY = 24 * 60 * 60 * 1000;
  // since is 6 am IST, i.e. 00:30 UTC of tonight's date; last night is a day before.
  let expected = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()) - DAY;
  for (const row of nightRows) {
    const value = row.night;
    const night =
      value instanceof Date
        ? Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
        : Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
    if (night !== expected) break;
    pastStreak += 1;
    expected -= DAY;
  }

  return { landings, pastStreak };
}
