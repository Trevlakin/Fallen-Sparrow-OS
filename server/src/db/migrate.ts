/**
 * Production-safe migrations (no drizzle-kit required at runtime).
 * Railway boot and `pnpm db:migrate` run the compiled dist/db/migrate.js.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    console.error("db:migrate: DATABASE_URL is required");
    process.exit(1);
  }

  const migrationsFolder = resolve(__dirname, "../../drizzle/migrations");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  console.log(`db:migrate: applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log("db:migrate: complete");
}

main().catch((err: unknown) => {
  console.error(
    "db:migrate: failed",
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
