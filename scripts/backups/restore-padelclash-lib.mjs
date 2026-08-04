import { spawn } from "node:child_process";
import { open, stat } from "node:fs/promises";

const EMPTY_TARGET_QUERY = `
WITH non_system_namespaces AS (
  SELECT oid
  FROM pg_namespace
  WHERE nspname NOT IN ('pg_catalog', 'information_schema')
    AND nspname NOT LIKE 'pg_toast%'
    AND nspname NOT LIKE 'pg_temp_%'
), target_objects AS (
  SELECT 'relation', c.oid::text FROM pg_class c
    JOIN non_system_namespaces n ON n.oid = c.relnamespace
  UNION ALL
  SELECT 'routine', p.oid::text FROM pg_proc p
    JOIN non_system_namespaces n ON n.oid = p.pronamespace
  UNION ALL
  SELECT 'type', t.oid::text FROM pg_type t
    JOIN non_system_namespaces n ON n.oid = t.typnamespace
  UNION ALL
  SELECT 'collation', c.oid::text FROM pg_collation c
    JOIN non_system_namespaces n ON n.oid = c.collnamespace
  UNION ALL
  SELECT 'conversion', c.oid::text FROM pg_conversion c
    JOIN non_system_namespaces n ON n.oid = c.connamespace
  UNION ALL
  SELECT 'operator', o.oid::text FROM pg_operator o
    JOIN non_system_namespaces n ON n.oid = o.oprnamespace
  UNION ALL
  SELECT 'operator class', o.oid::text FROM pg_opclass o
    JOIN non_system_namespaces n ON n.oid = o.opcnamespace
  UNION ALL
  SELECT 'operator family', o.oid::text FROM pg_opfamily o
    JOIN non_system_namespaces n ON n.oid = o.opfnamespace
  UNION ALL
  SELECT 'text search configuration', c.oid::text FROM pg_ts_config c
    JOIN non_system_namespaces n ON n.oid = c.cfgnamespace
  UNION ALL
  SELECT 'text search dictionary', d.oid::text FROM pg_ts_dict d
    JOIN non_system_namespaces n ON n.oid = d.dictnamespace
  UNION ALL
  SELECT 'text search parser', p.oid::text FROM pg_ts_parser p
    JOIN non_system_namespaces n ON n.oid = p.prsnamespace
  UNION ALL
  SELECT 'text search template', t.oid::text FROM pg_ts_template t
    JOIN non_system_namespaces n ON n.oid = t.tmplnamespace
  UNION ALL
  SELECT 'statistics', s.oid::text FROM pg_statistic_ext s
    JOIN non_system_namespaces n ON n.oid = s.stxnamespace
  UNION ALL
  SELECT 'namespace', n.oid::text FROM pg_namespace n
    WHERE n.oid IN (SELECT oid FROM non_system_namespaces)
      AND n.nspname <> 'public'
  UNION ALL
  SELECT 'extension', e.oid::text FROM pg_extension e WHERE e.extname <> 'plpgsql'
  UNION ALL
  SELECT 'cast', c.oid::text FROM pg_cast c WHERE c.oid >= 16384
  UNION ALL
  SELECT 'language', l.oid::text FROM pg_language l
    WHERE l.lanname NOT IN ('internal', 'c', 'sql', 'plpgsql')
  UNION ALL
  SELECT 'foreign-data wrapper', f.oid::text FROM pg_foreign_data_wrapper f
  UNION ALL
  SELECT 'foreign server', s.oid::text FROM pg_foreign_server s
  UNION ALL
  SELECT 'user mapping', u.umid::text FROM pg_user_mappings u
  UNION ALL
  SELECT 'event trigger', e.oid::text FROM pg_event_trigger e
  UNION ALL
  SELECT 'publication', p.oid::text FROM pg_publication p
  UNION ALL
  SELECT 'subscription', s.oid::text FROM pg_subscription s
    JOIN pg_database d ON d.oid = s.subdbid
    WHERE d.datname = current_database()
  UNION ALL
  SELECT 'large object', l.oid::text FROM pg_largeobject_metadata l
  UNION ALL
  SELECT 'default privileges', d.oid::text FROM pg_default_acl d
  UNION ALL
  SELECT 'security label', s.objoid::text FROM pg_seclabel s
  UNION ALL
  SELECT 'database setting', s.setrole::text FROM pg_db_role_setting s
    JOIN pg_database d ON d.oid = s.setdatabase
    WHERE d.datname = current_database()
  UNION ALL
  SELECT 'database ACL', d.oid::text FROM pg_database d
    WHERE d.datname = current_database() AND d.datacl IS NOT NULL
)
SELECT count(*) FROM target_objects;
`;

const CUSTOM_ARCHIVE_SIGNATURE = Buffer.from("PGDMP");

async function inspectArchive(archivePath) {
  const details = await stat(archivePath);
  if (!details.isFile()) return { custom: false, file: false, size: details.size };
  if (details.size <= 0) return { custom: false, file: true, size: details.size };

  const handle = await open(archivePath, "r");
  try {
    const signature = Buffer.alloc(CUSTOM_ARCHIVE_SIGNATURE.length);
    const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
    return {
      custom:
        bytesRead === CUSTOM_ARCHIVE_SIGNATURE.length &&
        signature.equals(CUSTOM_ARCHIVE_SIGNATURE),
      file: true,
      size: details.size,
    };
  } finally {
    await handle.close();
  }
}

export function connectionEnvironment(databaseUrl) {
  // This command must run directly under Node without importing the Next app.
  // Matching fixtures in both test suites enforce parity with the app parser.
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
  run = runRecoveryProcess,
}) {
  if (!archivePath) throw new Error("A trusted PadelClash archive is required.");
  let archive;
  try {
    archive = await inspectArchive(archivePath);
  } catch {
    throw new Error("The trusted PadelClash archive could not be read.");
  }
  if (!archive.file) {
    throw new Error(
      "The trusted PadelClash archive is not a PostgreSQL custom archive.",
    );
  }
  if (archive.size <= 0) throw new Error("The trusted PadelClash archive is empty.");
  if (!archive.custom) {
    throw new Error(
      "The trusted PadelClash archive is not a PostgreSQL custom archive.",
    );
  }

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
