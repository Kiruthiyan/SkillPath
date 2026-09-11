import "../load-env";
import { pool } from "../db/client";

/**
 * One-time, hand-written DDL for the Government/Private university type field.
 * Not run via `db:push` because this DB also has unmanaged handbook tables
 * (official_handbook_*) outside the Drizzle schema — a full push would try to
 * drop them. This script only touches the one column it needs.
 */
async function addUniversityTypeColumn() {
  await pool.query(`
    alter table universities
    add column if not exists type text not null default 'government'
  `);
  console.log('Added/confirmed "type" column on universities.');
}

addUniversityTypeColumn()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
