import { config } from "dotenv";
import type { Config } from "drizzle-kit";

// Next.js reads .env.local automatically; drizzle-kit does not.
config({ path: ".env.local" });
config({ path: ".env" });

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
