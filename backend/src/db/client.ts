import dns from "node:dns";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

// Supabase direct hostnames are IPv6-only; use verbatim order so Node tries AAAA records.
dns.setDefaultResultOrder("verbatim");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const connectionString = process.env.DATABASE_URL;

const isSupabaseHost =
  connectionString.includes("supabase.co") || connectionString.includes("supabase.com");

export const pool = new pg.Pool({
  connectionString,
  ssl: isSupabaseHost ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
