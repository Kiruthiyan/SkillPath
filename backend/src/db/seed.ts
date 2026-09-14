import bcrypt from "bcryptjs";
import { db, pool } from "./client";
import {
  careerPathsTable,
  alumniReviewsTable,
  successStoriesTable,
  usersTable,
} from "./schema/index";
import { eq } from "drizzle-orm";

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("  Skipping admin bootstrap (ADMIN_EMAIL/ADMIN_PASSWORD not set).");
    return;
  }

  const normalizedEmail = email.toLowerCase();
  const [existing] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (existing) {
    if (existing.role !== "admin") {
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, existing.id));
      console.log(`  Promoted existing user ${normalizedEmail} to admin.`);
    } else {
      console.log(`  ${normalizedEmail} is already an admin.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({
    email: normalizedEmail,
    passwordHash,
    name: "Admin",
    language: "en",
    role: "admin",
  });
  console.log(`  Created admin user ${normalizedEmail}.`);
}

/**
 * Production-safe seed: clear demo careers/reviews/stories and optionally
 * bootstrap an admin from env. Does not insert fake named people, salaries,
 * or verified alumni content.
 */
async function seed() {
  console.log("Seeding SkillPath AI database (admin bootstrap + clear demo content)...");

  await db.delete(successStoriesTable);
  await db.delete(alumniReviewsTable);
  await db.delete(careerPathsTable);
  console.log("  Cleared careers, alumni reviews, and success stories.");

  await ensureAdminUser();

  console.log("Seed completed successfully!");
  console.log("  Note: Run pnpm handbook:import to load UGC programme data.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
