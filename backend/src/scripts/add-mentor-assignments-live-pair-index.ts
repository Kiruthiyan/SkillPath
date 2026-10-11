import "../load-env";
import { pool } from "../db/client";

/**
 * One-time DDL to add the partial unique index preventing concurrent duplicate
 * mentor requests. Hand-written (not db:push) for the same reason as
 * add-university-type-column.ts: this DB also has unmanaged handbook tables.
 */
async function addLivePairIndex() {
  await pool.query(`
    create unique index if not exists mentor_assignments_live_pair_idx
    on mentor_assignments (mentor_user_id, student_user_id)
    where status in ('requested', 'accepted', 'active')
  `);
  console.log("Added/confirmed mentor_assignments_live_pair_idx.");
}

addLivePairIndex()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
