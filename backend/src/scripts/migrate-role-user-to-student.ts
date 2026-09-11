import "../load-env";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/client";
import { usersTable } from "../db/schema/index";

/**
 * One-time data fix for the role rename "user" -> "student" (RBAC alignment).
 * Idempotent: safe to re-run, only touches rows still carrying the old value.
 * Also updates the column's DB-level default, since register/insert paths omit
 * `role` and rely on Postgres's own default rather than the Drizzle schema value.
 */
async function migrateRoleUserToStudent() {
  const result = await db
    .update(usersTable)
    .set({ role: "student" })
    .where(eq(usersTable.role, "user"))
    .returning({ id: usersTable.id });

  console.log(`Updated ${result.length} user(s) from role "user" to "student".`);

  await pool.query(`alter table users alter column role set default 'student'`);
  console.log('Updated users.role column default to "student".');
}

migrateRoleUserToStudent()
  .catch((err) => {
    console.error("Role migration failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
