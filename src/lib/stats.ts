import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, users } from "@/lib/db/schema";

/** Pairings only: how many dancers there are is never counted or sent. */
export type CircleStats = {
  city: string | null;
  jodisToday: number;
  /**
   * Recent matches as city + minutes ago. Deliberately nameless: social proof
   * should not cost somebody their privacy, and "a jodi formed in Surat" is
   * just as convincing as naming her.
   */
  recent: { city: string; minutesAgo: number }[];
};

export async function circleStats(input: {
  city: string | null;
}): Promise<CircleStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [today] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(matches)
    .where(gt(matches.createdAt, since));

  const recentRows = await db
    .select({ createdAt: matches.createdAt, city: users.city })
    .from(matches)
    .innerJoin(users, eq(users.id, matches.userAId))
    .where(and(gt(matches.createdAt, since), isNotNull(users.city)))
    .orderBy(sql`${matches.createdAt} desc`)
    .limit(6);

  return {
    city: input.city,
    jodisToday: today?.n ?? 0,
    recent: recentRows.map((row) => ({
      city: row.city ?? "India",
      minutesAgo: Math.max(
        1,
        Math.round((Date.now() - row.createdAt.getTime()) / 60000),
      ),
    })),
  };
}
