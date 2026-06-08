#!/usr/bin/env node
/**
 * dev-local.mjs
 *
 * Starts everything needed for local development in one command:
 *   1. Embedded Postgres (db:local) — waits until it prints "Ready" before proceeding
 *   2. Express API (server dev)
 *   3. Vite frontend (web dev)
 *
 * Usage (from repo root):
 *   node scripts/dev-local.mjs
 *   pnpm dev
 *
 * Ctrl+C stops all three processes cleanly.
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const COLORS = {
  db: "\x1b[36m",   // cyan
  api: "\x1b[33m",  // yellow
  web: "\x1b[35m",  // magenta
  reset: "\x1b[0m",
};

const children = [];

function tag(name, color) {
  return `${color}[${name}]${COLORS.reset}`;
}

function spawnProc(label, color, cmd, args, opts = {}) {
  const proc = spawn(cmd, args, {
    cwd: root,
    stdio: ["inherit", "pipe", "pipe"],
    ...opts,
  });

  const prefix = tag(label, color);
  proc.stdout.on("data", (d) => process.stdout.write(`${prefix} ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`${prefix} ${d}`));

  proc.on("exit", (code, signal) => {
    if (signal !== "SIGTERM" && signal !== "SIGINT" && code !== 0) {
      console.error(`${prefix} exited with code ${code} — stopping all.`);
      killAll();
    }
  });

  children.push(proc);
  return proc;
}

function killAll() {
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch { /* already dead */ }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);

// Use npx pnpm so PATH issues don't matter on macOS
const PNPM = ["npx", "--yes", "pnpm@9.15.0"];

// Step 1: Start embedded Postgres and wait for it to be ready
console.log(`${tag("db", COLORS.db)} Starting embedded Postgres...`);

const dbProc = spawnProc("db ", COLORS.db, PNPM[0], [
  ...PNPM.slice(1),
  "--filter", "@fallen-sparrow/server",
  "db:local",
]);

// Wait for the "Ready" line before launching the API
await new Promise((resolve) => {
  const onData = (chunk) => {
    const text = chunk.toString();
    if (text.includes("Ready") || text.includes("ready") || text.includes("Postgres running")) {
      dbProc.stdout.off("data", onData);
      resolve();
    }
  };
  dbProc.stdout.on("data", onData);
  // Safety timeout: start API after 15 s even if we miss the ready line
  setTimeout(resolve, 15_000);
});

console.log(`${tag("db", COLORS.db)} Postgres is up — building shared package.`);

await new Promise((resolve, reject) => {
  const build = spawn(PNPM[0], [...PNPM.slice(1), "--filter", "@fallen-sparrow/shared", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  build.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`shared build exited with code ${code}`));
  });
});

console.log(`${tag("db", COLORS.db)} Starting API and frontend.`);

// Step 2: API server
spawnProc("api", COLORS.api, PNPM[0], [
  ...PNPM.slice(1),
  "--filter", "@fallen-sparrow/server",
  "dev",
]);

// Step 3: Vite frontend
spawnProc("web", COLORS.web, PNPM[0], [
  ...PNPM.slice(1),
  "--filter", "@fallen-sparrow/web",
  "dev",
]);
