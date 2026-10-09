/**
 * The cities a dancer can pick before spinning: every city someone is
 * actually dancing in, plus the popular ones, busiest first. Only names leave
 * the server: how many dancers are anywhere is never shown or sent.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { POPULAR_CITIES } from "@/lib/constants";

export type CityOption = { name: string };

type Row = Record<string, unknown>;

export async function cityOptions(meId: string): Promise<CityOption[]> {
  const result = await db.execute(sql`
    select
      min(trim(u.city))   as name,
      count(*)::int       as total
    from users u
    where u.profile_complete = true
      and u.suspended_at is null
      and u.id <> ${meId}::uuid
      and u.city is not null
      and trim(u.city) <> ''
    group by lower(trim(u.city))
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows) ?? [];

  const byKey = new Map<string, { name: string; total: number }>();
  for (const row of rows) {
    const name = String(row.name);
    byKey.set(name.toLowerCase(), { name, total: Number(row.total) });
  }
  for (const name of POPULAR_CITIES) {
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), { name, total: 0 });
  }

  return [...byKey.values()]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .map(({ name }) => ({ name }));
}
