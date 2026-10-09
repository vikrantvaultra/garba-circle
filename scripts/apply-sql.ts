/**
 * Applies one migration file to DATABASE_URL inside a single transaction, so
 * it either fully lands or changes nothing. For databases set up with
 * `db:push`, which have no migrations journal for `drizzle-kit migrate`.
 * Migration files run this way must be safe to re-run (IF [NOT] EXISTS).
 *
 *   npx tsx scripts/apply-sql.ts drizzle/0003_sign_in_accounts.sql
 *   vercel env run -e production -- npx tsx scripts/apply-sql.ts drizzle/…
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";

async function main() {
  const file = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!file) throw new Error("Usage: tsx scripts/apply-sql.ts <file.sql>");
  if (!url) throw new Error("DATABASE_URL is not set");

  const statements = readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  console.log(`Database host: ${new URL(url).hostname}`);
  try {
    await sql.begin(async (tx) => {
      for (const statement of statements) {
        console.log(`  ${statement.split("\n")[0].slice(0, 90)}`);
        await tx.unsafe(statement);
      }
    });
    const columns = await sql<{ column_name: string; is_nullable: string }[]>`
      select column_name, is_nullable from information_schema.columns
      where table_name = 'users'
        and column_name in ('phone', 'google_sub', 'email', 'username', 'password_hash')
      order by column_name`;
    console.log("Applied. users columns now:");
    for (const c of columns) console.log(`  ${c.column_name} (nullable: ${c.is_nullable})`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
