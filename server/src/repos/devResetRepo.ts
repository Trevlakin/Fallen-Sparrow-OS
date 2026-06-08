/**
 * Development-only: clear transactional data that feeds dashboard KPIs.
 */
import { sql } from "drizzle-orm";
import { db } from "../config/database.js";

export async function truncateDashboardData(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      qb_sync_queue,
      inventory_transactions,
      suggestions,
      brain_dumps,
      appointment_payments,
      commissions,
      appointments,
      expenses,
      incidents,
      task_queue,
      strategic_notes,
      briefings,
      nudges,
      sop_completions,
      porter_import_log
    RESTART IDENTITY CASCADE
  `);
}
