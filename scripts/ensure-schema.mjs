/**
 * Brings a Preview deployment's database up to the current schema before the
 * build, by applying every migration in drizzle/ and skipping what is
 * already there.
 *
 * Why: Preview uses its own database, and its credentials are marked
 * Sensitive in Vercel, so nobody can pull them to run `npm run db:migrate`
 * by hand. The build is the one place that has them. A preview whose
 * database missed a migration fails at sign-in with "column does not exist".
 *
 * Only runs when VERCEL_ENV is "preview" (or with --force). Production is
 * migrated deliberately, never as a side effect of a build.
 *
 * The migrations are schema only (CREATE / ALTER), and the databases were
 * created with `drizzle-kit push`, so there is no migrations journal to go
 * by: each statement runs on its own and "already exists" means done.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const force = process.argv.includes("--force");
if (process.env.VERCEL_ENV !== "preview" && !force) process.exit(0);

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.log("[ensure-schema] no DATABASE_URL, skipping");
  process.exit(0);
}

/** Postgres codes for "that table / column / constraint / index is already there". */
const ALREADY_THERE = new Set(["42P07", "42701", "42710", "42P06", "42P16"]);

const dir = join(import.meta.dirname, "..", "drizzle");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

let applied = 0;
let skipped = 0;
try {
  for (const file of files) {
    const statements = readFileSync(join(dir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
        applied++;
      } catch (error) {
        if (ALREADY_THERE.has(error?.code)) {
          skipped++;
          continue;
        }
        console.error(`[ensure-schema] ${file} failed:`, error?.message ?? error);
        process.exitCode = 1;
        throw error;
      }
    }
  }
  console.log(`[ensure-schema] ${applied} statements ran, ${skipped} were already in place`);
} finally {
  await sql.end();
}
