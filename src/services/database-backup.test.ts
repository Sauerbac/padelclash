import { access, mkdir, readFile, readdir, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  BackupBusyError,
  BackupGenerationError,
  BackupProcessUnconfirmedTerminationError,
  createDatabaseBackupService,
  databaseUrlToLibpqEnv,
  isPostgres17Version,
  runDatabaseBackupProcess,
  verifyPostgres17Tools,
  type ProcessRequest,
} from "./database-backup";

const DATABASE_URL =
  "postgresql://padel%20user:s3cr%40t@database.internal:5432/padelclash?sslmode=require";

describe("databaseUrlToLibpqEnv", () => {
  it("moves every connection field, including the password, out of arguments", () => {
    expect(databaseUrlToLibpqEnv(DATABASE_URL)).toEqual({
      PGDATABASE: "padelclash",
      PGHOST: "database.internal",
      PGPASSWORD: "s3cr@t",
      PGPORT: "5432",
      PGSSLMODE: "require",
      PGUSER: "padel user",
    });
  });
});

describe("PostgreSQL client version", () => {
  it("accepts only major version 17", () => {
    expect(isPostgres17Version("pg_dump (PostgreSQL) 17.5")).toBe(true);
    expect(isPostgres17Version("pg_dump (PostgreSQL) 16.9")).toBe(false);
    expect(isPostgres17Version("not PostgreSQL")).toBe(false);
  });

  it("bounds a version probe without claiming the child has closed", async () => {
    vi.useFakeTimers();
    try {
      const child = new EventEmitter() as ChildProcess;
      Object.defineProperty(child, "stderr", { value: null });
      Object.defineProperty(child, "stdout", { value: null });
      child.kill = vi.fn(() => true);
      const verification = verifyPostgres17Tools(100, () => child);
      const rejection = expect(verification).rejects.toBeInstanceOf(
        BackupProcessUnconfirmedTerminationError,
      );
      child.emit("spawn");

      await vi.advanceTimersByTimeAsync(1_100);

      await rejection;
      expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("database backup process deadline", () => {
  it("requests termination at the deadline but does not settle before close", async () => {
    vi.useFakeTimers();
    try {
      const child = new EventEmitter() as ChildProcess;
      Object.defineProperty(child, "stderr", { value: null });
      child.kill = vi.fn(() => true);
      const processPromise = runDatabaseBackupProcess(
        {
          command: "pg_dump",
          args: ["--version"],
          env: { ...process.env },
          timeoutMs: 100,
        },
        () => child,
      );
      let settled = false;
      void processPromise.then(
        () => (settled = true),
        () => (settled = true),
      );
      child.emit("spawn");

      await vi.advanceTimersByTimeAsync(100);

      expect(child.kill).toHaveBeenCalledWith("SIGKILL");
      expect(settled).toBe(false);
      child.emit("close", null, "SIGKILL");
      await expect(processPromise).rejects.toThrow("timed out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bounds the caller but exposes ownership until close is observed", async () => {
    vi.useFakeTimers();
    try {
      const child = new EventEmitter() as ChildProcess;
      Object.defineProperty(child, "stderr", { value: null });
      child.kill = vi.fn(() => true);
      const processPromise = runDatabaseBackupProcess(
        {
          command: "pg_dump",
          args: ["--version"],
          env: { ...process.env },
          timeoutMs: 100,
        },
        () => child,
      );
      let processError: unknown;
      const rejection = processPromise.catch((error) => {
        processError = error;
      });
      child.emit("spawn");

      await vi.advanceTimersByTimeAsync(1_100);

      expect(child.kill).toHaveBeenCalledWith("SIGKILL");
      await rejection;
      expect(processError).toBeInstanceOf(
        BackupProcessUnconfirmedTerminationError,
      );
      let ownershipEnded = false;
      const closed = (
        processError as BackupProcessUnconfirmedTerminationError
      ).closed.then(() => (ownershipEnded = true));
      expect(ownershipEnded).toBe(false);
      child.emit("close", null, "SIGKILL");
      await closed;
      expect(ownershipEnded).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("database backup service", () => {
  it("creates and validates a private archive without putting secrets in argv", async () => {
    const root = join(tmpdir(), `padelclash-backup-test-${crypto.randomUUID()}`);
    const run = vi.fn(async ({ command, args }: ProcessRequest) => {
      if (command === "pg_dump") {
        const output = args.at(-1)!;
        await writeFile(output, "archive");
      }
    });
    const service = createDatabaseBackupService({
      databaseUrl: () => DATABASE_URL,
      now: () => new Date("2026-08-04T12:34:56Z"),
      run,
      tempRoot: root,
      verifyTools: async () => {},
    });

    const artifact = await service.generate();

    expect(artifact.filename).toBe("padelclash-20260804T123456Z.dump");
    expect(await readFile(artifact.path, "utf8")).toBe("archive");
    expect(run).toHaveBeenCalledTimes(2);
    for (const call of run.mock.calls) {
      expect(call[0].args.join(" ")).not.toContain("s3cr");
      expect(call[0].env.PGPASSWORD).toBe("s3cr@t");
      expect(call[0].env.DATABASE_URL).toBeUndefined();
      expect(call[0].timeoutMs).toBe(60_000);
    }
    expect(run.mock.calls[0][0].args).toContain("--lock-wait-timeout=5s");
    expect(run.mock.calls[1][0].args).toEqual(["--list", artifact.path]);

    await artifact.dispose();
    await expect(access(artifact.path)).rejects.toThrow();
  });

  it("refuses overlapping generation and releases the lease after failure", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));
    const root = join(tmpdir(), `padelclash-backup-test-${crypto.randomUUID()}`);
    const service = createDatabaseBackupService({
      databaseUrl: () => DATABASE_URL,
      run: async ({ command, args }) => {
        if (command === "pg_dump") {
          await blocked;
          await writeFile(args.at(-1)!, "archive");
        }
      },
      tempRoot: root,
      verifyTools: async () => {},
    });

    const first = service.generate();
    await vi.waitFor(() => expect(service.isBusy()).toBe(true));
    await expect(service.generate()).rejects.toBeInstanceOf(BackupBusyError);
    release();
    await (await first).dispose();
    expect(service.isBusy()).toBe(false);
  });

  it("removes partial and recent orphan request directories after subprocess failure", async () => {
    const root = join(tmpdir(), `padelclash-backup-test-${crypto.randomUUID()}`);
    const stale = join(root, "request-stale");
    await mkdir(stale, { recursive: true, mode: 0o700 });
    await writeFile(join(stale, "secret.dump"), "old");
    const recent = new Date("2026-08-04T12:34:55Z");
    await utimes(stale, recent, recent);
    const service = createDatabaseBackupService({
      databaseUrl: () => DATABASE_URL,
      now: () => new Date("2026-08-04T12:34:56Z"),
      run: async () => {
        throw new Error(`pg_dump leaked ${DATABASE_URL}`);
      },
      tempRoot: root,
      verifyTools: async () => {},
    });

    await expect(service.generate()).rejects.toEqual(
      new BackupGenerationError("Database backup could not be prepared."),
    );
    expect(await readdir(root)).toEqual([]);
    if (process.platform !== "win32") {
      expect((await stat(root)).mode & 0o777).toBe(0o700);
    }
  });

  it("does not purge an artifact still being delivered by this process", async () => {
    const root = join(tmpdir(), `padelclash-backup-test-${crypto.randomUUID()}`);
    const service = createDatabaseBackupService({
      databaseUrl: () => DATABASE_URL,
      run: async ({ command, args }) => {
        if (command === "pg_dump") await writeFile(args.at(-1)!, "archive");
      },
      tempRoot: root,
      verifyTools: async () => {},
    });

    const first = await service.generate();
    const second = await service.generate();

    expect(await readFile(first.path, "utf8")).toBe("archive");
    await first.dispose();
    await second.dispose();
    expect(await readdir(root)).toEqual([]);
  });

  it("retains the lease and partial artifact until a timed-out child closes", async () => {
    vi.useFakeTimers();
    const root = join(tmpdir(), `padelclash-backup-test-${crypto.randomUUID()}`);
    try {
      let markProcessStarted!: () => void;
      const processStarted = new Promise<void>((resolve) => {
        markProcessStarted = resolve;
      });
      const child = new EventEmitter() as ChildProcess;
      Object.defineProperty(child, "stderr", { value: null });
      Object.defineProperty(child, "stdout", { value: null });
      child.kill = vi.fn(() => true);
      const service = createDatabaseBackupService({
        databaseUrl: () => DATABASE_URL,
        run: async (request) => {
          await writeFile(request.args.at(-1)!, "partial");
          markProcessStarted();
          return runDatabaseBackupProcess(request, () => child);
        },
        tempRoot: root,
        verifyTools: async () => {},
      });

      const generation = service.generate();
      const rejection = expect(generation).rejects.toBeInstanceOf(
        BackupGenerationError,
      );
      await processStarted;
      expect(service.isBusy()).toBe(true);
      child.emit("spawn");
      await vi.advanceTimersByTimeAsync(61_000);
      await rejection;

      expect(service.isBusy()).toBe(true);
      expect(await readdir(root)).toHaveLength(1);
      await expect(service.generate()).rejects.toBeInstanceOf(BackupBusyError);

      child.emit("close", null, "SIGKILL");
      vi.useRealTimers();
      await vi.waitFor(() => expect(service.isBusy()).toBe(false));
      expect(await readdir(root)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes an archive that fails catalogue validation", async () => {
    const root = join(tmpdir(), `padelclash-backup-test-${crypto.randomUUID()}`);
    const service = createDatabaseBackupService({
      databaseUrl: () => DATABASE_URL,
      run: async ({ command, args }) => {
        if (command === "pg_dump") await writeFile(args.at(-1)!, "archive");
        else throw new Error("invalid catalogue");
      },
      tempRoot: root,
      verifyTools: async () => {},
    });

    await expect(service.generate()).rejects.toBeInstanceOf(BackupGenerationError);
    expect(await readdir(root)).toEqual([]);
  });

  it("passes cancellation to the subprocess and removes its partial artifact", async () => {
    const root = join(tmpdir(), `padelclash-backup-test-${crypto.randomUUID()}`);
    const controller = new AbortController();
    const run = vi.fn(async ({ args, signal }: ProcessRequest) => {
      const cancellation = new Promise<void>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("cancelled")), {
          once: true,
        });
      });
      await writeFile(args.at(-1)!, "partial");
      await cancellation;
    });
    const service = createDatabaseBackupService({
      databaseUrl: () => DATABASE_URL,
      run,
      tempRoot: root,
      verifyTools: async () => {},
    });

    const generation = service.generate(controller.signal);
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    controller.abort();

    await expect(generation).rejects.toBeInstanceOf(BackupGenerationError);
    expect(service.isBusy()).toBe(false);
    expect(await readdir(root)).toEqual([]);
  });
});
