import "../load-env";
import { pool } from "./client";
import { syncYearModelFromVerifiedCutoffs } from "./year-modeling";

syncYearModelFromVerifiedCutoffs()
  .then((results) => {
    console.log(JSON.stringify(results, null, 2));
  })
  .finally(async () => {
    await pool.end();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
