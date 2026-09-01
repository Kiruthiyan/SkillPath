import "./src/load-env";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/db/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined,
  },
});
