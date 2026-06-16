/**
 * Local Postgres without Docker — uses embedded-postgres (downloads binaries on first run).
 * Usage: tsx scripts/setup-local-db.ts
 * Keeps running until Ctrl+C. Run migrate/seed on first start.
 */
import { spawn } from "node:child_process";
import { existsSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(__dirname, "..");
const repoRoot = resolve(serverRoot, "..");
const dataDir = resolve(serverRoot, ".pgdata");
const DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/fallen_sparrow";

async function run(cmd: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${cmd} exited with ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port: 5432,
    database: "fallen_sparrow",
    persistent: true,
    initdbFlags: ["--auth-host=trust", "--auth-local=trust"],
  });

  const hasCluster = existsSync(resolve(dataDir, "PG_VERSION"));
  if (hasCluster) {
    // Postgres requires 0700 or 0750 on the data directory; macOS/Cursor can loosen this.
    try {
      chmodSync(dataDir, 0o700);
    } catch {
      /* best effort */
    }
  }
  if (!hasCluster) {
    console.log("[local-db] Initializing embedded Postgres (first run may download binaries)...");
    await pg.initialise();
  } else {
    console.log("[local-db] Using existing cluster in", dataDir);
  }
  await pg.start();
  console.log("[local-db] Postgres running at", DATABASE_URL);

  const pgModule = await import("pg");
  const admin = new pgModule.default.Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  });
  await admin.connect();
  const exists = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    ["fallen_sparrow"],
  );
  if (exists.rowCount === 0) {
    await admin.query("CREATE DATABASE fallen_sparrow");
    console.log("[local-db] Created database fallen_sparrow");
  }
  await admin.end();

  const marker = resolve(dataDir, ".fallen-sparrow-seeded");
  if (!existsSync(marker)) {
    console.log("[local-db] Running migrations...");
    await run("npx", ["tsx", "src/db/migrate.ts"], serverRoot);
    console.log("[local-db] Seeding database...");
    await run("npx", ["tsx", "src/db/seed.ts"], serverRoot);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(marker, new Date().toISOString());
    console.log("[local-db] Seed complete.");
  } else {
    console.log("[local-db] Already seeded — skipping migrate/seed (delete .pgdata to reset).");
  }

  console.log("[local-db] Ready. Sign in: owner@fallensparrow.local / ChangeMe123!");
  console.log("[local-db] Press Ctrl+C to stop Postgres.");

  const shutdown = async () => {
    console.log("\n[local-db] Stopping...");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[local-db] Failed:", err);
  process.exit(1);
});
