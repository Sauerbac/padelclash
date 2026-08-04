import { describe, expect, it, vi } from "vitest";
import { restorePadelClash } from "./restore-padelclash-lib.mjs";

const DATABASE_URL =
  "postgresql://restore_user:never-print-me@database.internal:5432/padelclash_restore?sslmode=require";

function runner({ targetCount = "0", failRestore = false } = {}) {
  return vi.fn(async ({ command, args }) => {
    if (args.includes("--version")) return `${command} (PostgreSQL) 17.5`;
    if (command === "psql" && args.includes("--tuples-only")) return targetCount;
    if (command === "pg_restore" && args.includes("--single-transaction") && failRestore) {
      throw new Error(`raw failure ${DATABASE_URL}`);
    }
    return "";
  });
}

describe("production PadelClash recovery", () => {
  it("restores with PostgreSQL 17 in one transaction and analyzes afterward", async () => {
    const run = runner();

    await restorePadelClash({
      archivePath: "C:/trusted/padelclash-20260804T123456Z.dump",
      databaseUrl: DATABASE_URL,
      fileSize: async () => 42,
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
      "C:/trusted/padelclash-20260804T123456Z.dump",
    ]);
    expect(restore.env.PGPASSWORD).toBe("never-print-me");
    expect(restore.args.join(" ")).not.toContain("never-print-me");
    expect(run.mock.calls.at(-1)[0]).toMatchObject({ command: "psql" });
    expect(run.mock.calls.at(-1)[0].args).toContain("ANALYZE");
  });

  it("refuses a target containing application objects before restore", async () => {
    const run = runner({ targetCount: "1" });

    await expect(
      restorePadelClash({
        archivePath: "trusted.dump",
        databaseUrl: DATABASE_URL,
        fileSize: async () => 42,
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

    await expect(
      restorePadelClash({
        archivePath: "trusted.dump",
        databaseUrl: DATABASE_URL,
        fileSize: async () => 42,
        run,
      }),
    ).rejects.toThrow("Archive restore failed; the target was left unchanged.");
    const commands = run.mock.calls.map(([request]) => request.args.join(" "));
    expect(commands.join(" ")).not.toContain("never-print-me");
    expect(commands.some((args) => args.includes("ANALYZE"))).toBe(false);
  });
});
