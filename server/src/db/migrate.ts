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

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }

  const migrationsFolder = resolve(__dirname, "../../drizzle/migrations");
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log(`db:migrate: applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  await pool.end();
  console.log("db:migrate: complete");
}

async function main(): Promise<void> {
  await runMigrations();
}

const isMain =
  process.argv[1] != null &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err: unknown) => {
    console.error(
      "db:migrate: failed",
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  });
}
