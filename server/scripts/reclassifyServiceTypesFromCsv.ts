/**
 * Reclassify service types on historical CSV imports without duplicating rows.
 *
 * Usage:
 *   npx tsx scripts/reclassifyServiceTypesFromCsv.ts /path/to/appointments.csv
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reclassifyServiceTypesFromCsv } from "../src/services/csvImportService.js";

async function main(): Promise<void> {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      "Usage: tsx scripts/reclassifyServiceTypesFromCsv.ts <appointments.csv>",
    );
    process.exit(1);
  }

  const absolutePath = resolve(csvPath);
  const csvString = readFileSync(absolutePath, "utf8");
  const result = await reclassifyServiceTypesFromCsv(csvString);

  console.log(
    JSON.stringify(
      {
        file: absolutePath,
        updated: result.imported,
        skipped: result.skipped,
        errors: result.errors.slice(0, 20),
        errorCount: result.errors.length,
      },
      null,
      2,
    ),
  );

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
