/** Prints what DATABASE_URL points at. Handy after switching environments. */
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { prepare: false, max: 1 });
  const [info] = await sql`select current_database() as db, version() as v`;
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `;
  console.log("database:", info.db);
  console.log("server:  ", String(info.v).split(" on ")[0]);
  console.log("tables:  ", tables.length ? tables.map((t) => t.table_name).join(", ") : "(none)");
  await sql.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
