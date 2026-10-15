import { drizzle } from "drizzle-orm/mysql2";

type SqlDb = ReturnType<typeof drizzle>;

let client: SqlDb | null = null;

/** One shared Drizzle/MySQL handle for the app data layer and BetterAuth. */
export function getSqlClient(): SqlDb | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!client) client = drizzle(url);
  return client;
}
