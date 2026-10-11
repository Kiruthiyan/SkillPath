import "../load-env";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "../db/client";
import { usersTable } from "../db/schema/index";

/**
 * One-time idempotent bootstrap for the platform's single super admin.
 * Reads credentials from env only — never hardcode or commit real values.
 * Safe to re-run: never overwrites an existing user's password or mustChangePassword flag.
 */
async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_TEMP_PASSWORD;

  if (!email || !password) {
    console.log("Skipping super admin seed (SUPER_ADMIN_EMAIL/SUPER_ADMIN_TEMP_PASSWORD not set).");
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const [existing] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (existing) {
    if (existing.role !== "super_admin") {
      await db.update(usersTable).set({ role: "super_admin" }).where(eq(usersTable.id, existing.id));
      console.log(`Promoted existing user ${normalizedEmail} to super_admin.`);
    } else {
      console.log(`${normalizedEmail} is already the super admin. No changes made.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({
    email: normalizedEmail,
    passwordHash,
    name: "Super Admin",
    language: "en",
    role: "super_admin",
    mustChangePassword: true,
  });
  console.log(`Created super admin ${normalizedEmail}. Temporary password must be changed on first login.`);
}

seedSuperAdmin()
  .catch((err) => {
    console.error("Super admin seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
