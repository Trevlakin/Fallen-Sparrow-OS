/**
 * Background job scheduler entry (MASTER_SPEC_v3 §7).
 */
import { startBriefingJobs } from "./briefingJob.js";
import { logger } from "../utils/logger.js";

export function startAllJobs(): void {
  try {
    startBriefingJobs();
  } catch (err) {
    logger.error("Failed to start background jobs", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
