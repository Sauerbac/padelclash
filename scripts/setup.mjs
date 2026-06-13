// One-shot local bootstrap: a fresh clone goes from zero to a migrated database.
//
// Sequence (Q6): ensure .env exists → start the compose Postgres and wait for it
// to be healthy → apply migrations. Deliberately stops before `npm run dev`
// (interactive) and before `npm run db:seed` (a stub until slice 04), so this is
// safe to run non-interactively. Assumes `npm install` already ran — npm scripts
// need node_modules to exist.
import { existsSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

// 1. .env from the template, only if missing (idempotent — never clobbers yours).
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("[setup] created .env from .env.example");
} else {
  console.log("[setup] .env already exists, leaving it untouched");
}

// 2. Local Postgres via compose, blocking until the healthcheck passes.
console.log("[setup] starting Postgres (docker compose up -d --wait db)...");
run("docker compose up -d --wait db");

// 3. Apply versioned migrations against it.
console.log("[setup] applying migrations...");
run("npm run db:migrate");

console.log(
  "\n[setup] done. `npm run dev` to start the app" +
    " (and `npm run db:seed` once it's implemented in slice 04).",
);
