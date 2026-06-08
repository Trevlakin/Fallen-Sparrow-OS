import { pool } from "../config/database.js";
import { getPgErrorCode } from "../utils/pgErrors.js";

export type DatabaseReadyStatus = {
  ready: boolean;
  pgCode: string | null;
  hint: string;
};

export async function getDatabaseReadyStatus(): Promise<DatabaseReadyStatus> {
  try {
    await pool.query("SELECT 1");
    return {
      ready: true,
      pgCode: null,
      hint: "Database connection OK.",
    };
  } catch (err) {
    const pgCode = getPgErrorCode(err);
    let hint =
      "Set DATABASE_URL on the API service to a Railway Postgres reference, then redeploy.";
    if (pgCode === "42P01" || pgCode === "3F000") {
      hint =
        "Schema not migrated yet. Redeploy the API service or check deploy logs for migration errors.";
    }
    return { ready: false, pgCode, hint };
  }
}
