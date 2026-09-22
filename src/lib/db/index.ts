import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __garbaSql: ReturnType<typeof postgres> | undefined;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

function connect(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Postgres connection string.",
    );
  }

  // Next.js hot-reloads modules in dev; without the global we would open a new
  // pool on every save until the database refuses connections.
  // prepare:false is required by transaction-mode poolers (Neon, Supabase).
  const client =
    globalThis.__garbaSql ?? postgres(url, { prepare: false, max: 1 });
  if (process.env.NODE_ENV !== "production") globalThis.__garbaSql = client;

  return drizzle(client, { schema });
}

/**
 * Connecting lazily rather than at import time matters for two reasons: the
 * production build collects route metadata without any env vars set, and a
 * cold function that never touches the database never pays for a connection.
 */
export const db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    if (!cached) cached = connect();
    const value = Reflect.get(cached, property, receiver);
    return typeof value === "function" ? value.bind(cached) : value;
  },
});

export { schema };
