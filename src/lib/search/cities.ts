/**
 * The cities a dancer can pick before spinning: every city someone is
 * actually dancing in, plus the popular ones, each with a real count of who
 * is there so nobody spins into an empty city without knowing.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { POPULAR_CITIES } from "@/lib/constants";

export type CityOption = {
  name: string;
  female: number;
  male: number;
  /** Everyone, including dancers who chose "other". */
  total: number;
};

type Row = Record<string, unknown>;

export async function cityOptions(meId: string): Promise<CityOption[]> {
  const result = await db.execute(sql`
    select
      min(trim(u.city))                                    as name,
      count(*) filter (where u.gender = 'female')::int      as female,
      count(*) filter (where u.gender = 'male')::int        as male,
      count(*)::int                                         as total
    from users u
    where u.profile_complete = true
      and u.suspended_at is null
      and u.id <> ${meId}::uuid
      and u.city is not null
      and trim(u.city) <> ''
    group by lower(trim(u.city))
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows) ?? [];

  const byKey = new Map<string, CityOption>();
  for (const row of rows) {
    const name = String(row.name);
    byKey.set(name.toLowerCase(), {
      name,
      female: Number(row.female),
      male: Number(row.male),
      total: Number(row.total),
    });
  }
  for (const name of POPULAR_CITIES) {
    if (!byKey.has(name.toLowerCase())) {
      byKey.set(name.toLowerCase(), { name, female: 0, male: 0, total: 0 });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name),
  );
}
