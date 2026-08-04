import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectionEnvironment,
  restorePadelClash,
} from "./restore-padelclash-lib.mjs";

const DATABASE_URL =
  "postgresql://restore_user:never-print-me@database.internal:5432/padelclash_restore?sslmode=require";
const PARITY_DATABASE_URL =
  "postgresql://padel%20user:s3cr%40t@database.internal:5432/padelclash?sslmode=require";

const fixtureRoots = [];

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function archiveFixture(kind = "custom") {
  const root = await mkdtemp(join(tmpdir(), "padelclash-recovery-test-"));
  fixtureRoots.push(root);
  const archivePath = join(root, "trusted.dump");
  if (kind === "directory") await mkdir(archivePath);
  else if (kind === "custom") await writeFile(archivePath, "PGDMPfixture");
  else await writeFile(archivePath, "tar archive fixture");
  return archivePath;
}

function runner({ targetCount = "0", failRestore = false } = {}) {
  return vi.fn(async ({ command, args }) => {
    if (args.includes("--version")) return `${command} (PostgreSQL) 17.5`;
    if (command === "psql" && args.includes("--tuples-only")) {
      const query = args.at(-1);
      if (/FROM pg_user_mapping\s/.test(query)) {
        throw new Error("permission denied for table pg_user_mapping");
      }
      return targetCount;
    }
    if (command === "pg_restore" && args.includes("--single-transaction") && failRestore) {
      throw new Error(`raw failure ${DATABASE_URL}`);
    }
    return "";
  });
}

describe("production PadelClash recovery", () => {
  it("keeps standalone libpq parsing in parity with the Admin backup service", () => {
    const { database, env } = connectionEnvironment(PARITY_DATABASE_URL);

    expect(database).toBe("padelclash");
    expect(env).toMatchObject({
      PGDATABASE: "padelclash",
      PGHOST: "database.internal",
      PGPASSWORD: "s3cr@t",
      PGPORT: "5432",
      PGSSLMODE: "require",
      PGUSER: "padel user",
    });
    expect(env.DATABASE_URL).toBeUndefined();
  });

  it("restores with PostgreSQL 17 in one transaction and analyzes afterward", async () => {
    const run = runner();
    const archivePath = await archiveFixture();

    await restorePadelClash({
      archivePath,
      databaseUrl: DATABASE_URL,
      run,
    });

    const restore = run.mock.calls.find(
      ([request]) =>
        request.command === "pg_restore" &&
        request.args.includes("--single-transaction"),
    )[0];
    expect(restore.args).toEqual([
      "--exit-on-error",
      "--single-transaction",
      "--no-owner",
      "--no-acl",
      "--dbname=padelclash_restore",
      archivePath,
    ]);
    expect(restore.env.PGPASSWORD).toBe("never-print-me");
    expect(restore.args.join(" ")).not.toContain("never-print-me");
    expect(run.mock.calls.at(-1)[0]).toMatchObject({ command: "psql" });
    expect(run.mock.calls.at(-1)[0].args).toContain("ANALYZE");
  });

  it("refuses a target containing application objects before restore", async () => {
    const run = runner({ targetCount: "1" });
    const archivePath = await archiveFixture();

    await expect(
      restorePadelClash({
        archivePath,
        databaseUrl: DATABASE_URL,
        run,
      }),
    ).rejects.toThrow("Recovery target is not empty");
    expect(
      run.mock.calls.some(([request]) =>
        request.args.includes("--single-transaction"),
      ),
    ).toBe(false);
  });

  it("reports a sanitized restore failure and does not analyze", async () => {
    const run = runner({ failRestore: true });
    const archivePath = await archiveFixture();

    await expect(
      restorePadelClash({
        archivePath,
        databaseUrl: DATABASE_URL,
        run,
      }),
    ).rejects.toThrow("Archive restore failed; the target was left unchanged.");
    const commands = run.mock.calls.map(([request]) => request.args.join(" "));
    expect(commands.join(" ")).not.toContain("never-print-me");
    expect(commands.some((args) => args.includes("ANALYZE"))).toBe(false);
  });

  it.each(["tar", "directory"])(
    "rejects a %s archive before inspecting the recovery target",
    async (kind) => {
      const run = runner();
      const archivePath = await archiveFixture(kind);

      await expect(
        restorePadelClash({ archivePath, databaseUrl: DATABASE_URL, run }),
      ).rejects.toThrow("not a PostgreSQL custom archive");
      expect(run).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["custom collation", "pg_collation"],
    ["changed default privileges", "pg_default_acl"],
    [
      "subscription in the target database",
      "d.oid = s.subdbid",
    ],
  ])("refuses a target containing %s", async (_state, requiredCatalog) => {
    const archivePath = await archiveFixture();
    const run = vi.fn(async ({ command, args }) => {
      if (args.includes("--version")) return `${command} (PostgreSQL) 17.5`;
      if (command === "psql" && args.includes("--tuples-only")) {
        const query = args.at(-1);
        return query.includes(requiredCatalog) ? "1" : "0";
      }
      return "";
    });

    await expect(
      restorePadelClash({ archivePath, databaseUrl: DATABASE_URL, run }),
    ).rejects.toThrow("Recovery target is not empty");
    expect(
      run.mock.calls.some(([request]) =>
        request.args.includes("--single-transaction"),
      ),
    ).toBe(false);
  });
});
