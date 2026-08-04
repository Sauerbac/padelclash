import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";

const EMPTY_TARGET_QUERY = `
SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f'))
  +
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema'))
  +
  (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
     AND t.typtype IN ('c', 'd', 'e'))
  +
  (SELECT count(*) FROM pg_namespace n
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'public')
     AND n.nspname NOT LIKE 'pg_toast%'
     AND n.nspname NOT LIKE 'pg_temp_%');
`;

export function connectionEnvironment(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("Recovery database connection is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
    throw new Error("Recovery database connection is invalid.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("Recovery database connection is invalid.");
  const env = {
    ...process.env,
    PGDATABASE: database,
    PGHOST: url.hostname,
    PGPASSWORD: decodeURIComponent(url.password),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
  };
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  delete env.DATABASE_URL;
  return { database, env };
}

export async function runRecoveryProcess({ command, args, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      if (stdout.length < 1_000_000) stdout += chunk.toString();
    });
    child.stderr.resume();
    child.once("error", () => reject(new Error(`${command} could not be started.`)));
    child.once("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} failed.`));
    });
  });
}

async function requirePostgres17(command, env, run) {
  let version;
  try {
    version = await run({ command, args: ["--version"], env });
  } catch {
    throw new Error("PostgreSQL 17 client tools are required.");
  }
  if (!/\(PostgreSQL\) 17\./.test(version)) {
    throw new Error("PostgreSQL 17 client tools are required.");
  }
}

export async function restorePadelClash({
  archivePath,
  databaseUrl,
  fileSize = async (path) => (await stat(path)).size,
  run = runRecoveryProcess,
}) {
  if (!archivePath) throw new Error("A trusted PadelClash archive is required.");
  let size;
  try {
    size = await fileSize(archivePath);
  } catch {
    throw new Error("The trusted PadelClash archive could not be read.");
  }
  if (size <= 0) throw new Error("The trusted PadelClash archive is empty.");

  const { database, env } = connectionEnvironment(databaseUrl);
  await requirePostgres17("pg_restore", env, run);
  await requirePostgres17("psql", env, run);

  try {
    await run({ command: "pg_restore", args: ["--list", archivePath], env });
  } catch {
    throw new Error("The trusted PadelClash archive is not a readable PostgreSQL 17 custom archive.");
  }

  let objectCount;
  try {
    objectCount = await run({
      command: "psql",
      args: [
        `--dbname=${database}`,
        "--no-psqlrc",
        "--tuples-only",
        "--no-align",
        "--command",
        EMPTY_TARGET_QUERY,
      ],
      env,
    });
  } catch {
    throw new Error("Recovery target could not be inspected.");
  }
  if (objectCount.trim() !== "0") {
    throw new Error("Recovery target is not empty; no restore was attempted.");
  }

  try {
    await run({
      command: "pg_restore",
      args: [
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-acl",
        `--dbname=${database}`,
        archivePath,
      ],
      env,
    });
  } catch {
    throw new Error("Archive restore failed; the target was left unchanged.");
  }

  try {
    await run({
      command: "psql",
      args: [`--dbname=${database}`, "--no-psqlrc", "--command", "ANALYZE"],
      env,
    });
  } catch {
    throw new Error("Restore committed, but ANALYZE failed; run ANALYZE manually.");
  }
}
