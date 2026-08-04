import {
  spawn,
  type ChildProcess,
  type SpawnOptions,
} from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { join } from "node:path";

const PROCESS_TIMEOUT_MS = 60_000;
const PROCESS_CLOSE_TIMEOUT_MS = 1_000;
const TOOL_VERSION_TIMEOUT_MS = 5_000;
const REQUEST_PREFIX = "request-";

export class BackupBusyError extends Error {
  constructor() {
    super("A database backup is already being prepared.");
    this.name = "BackupBusyError";
  }
}

export class BackupGenerationError extends Error {
  constructor(message = "Database backup could not be prepared.") {
    super(message);
    this.name = "BackupGenerationError";
  }
}

export class BackupProcessUnconfirmedTerminationError extends Error {
  constructor(
    message: string,
    readonly closed: Promise<void>,
  ) {
    super(message);
    this.name = "BackupProcessUnconfirmedTerminationError";
  }
}

type LibpqEnv = Record<string, string> & {
  PGDATABASE: string;
  PGHOST: string;
  PGPASSWORD: string;
  PGPORT: string;
  PGUSER: string;
};

export function databaseUrlToLibpqEnv(connectionString: string): LibpqEnv {
  // Keep this TypeScript/Next boundary independent from the standalone .mjs
  // recovery command. Matching fixtures in both test suites enforce parity.
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new BackupGenerationError();
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new BackupGenerationError();
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new BackupGenerationError();

  const env: LibpqEnv = {
    PGDATABASE: database,
    PGHOST: url.hostname,
    PGPASSWORD: decodeURIComponent(url.password),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
  };
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

export interface ProcessRequest {
  command: "pg_dump" | "pg_restore";
  args: string[];
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs: number;
  captureOutput?: boolean;
}

type ProcessRunner = (request: ProcessRequest) => Promise<string | void>;
type StartProcess = (
  command: "pg_dump" | "pg_restore",
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

export async function runDatabaseBackupProcess(
  { command, args, captureOutput = false, env, signal, timeoutMs }: ProcessRequest,
  startProcess: StartProcess = (literalCommand, literalArgs, options) =>
    literalCommand === "pg_dump"
      ? spawn("pg_dump", literalArgs, options)
      : spawn("pg_restore", literalArgs, options),
): Promise<string> {
  let markClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve;
  });
  return await new Promise<string>((resolve, reject) => {
    const options = {
      env,
      shell: false,
      stdio: [
        "ignore",
        captureOutput ? "pipe" : "ignore",
        "pipe",
      ] as SpawnOptions["stdio"],
      windowsHide: true,
    };
    // Literal executable names keep Next's production file tracer scoped. A
    // dynamic spawn target makes it conservatively trace the whole repository.
    const child = startProcess(command, args, options);
    let settled = false;
    let spawned = false;
    let terminationStarted = false;
    let terminationError: Error | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let stdout = "";
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(closeTimer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(stdout);
    };
    const terminate = (error: Error) => {
      if (terminationStarted || settled) return;
      terminationStarted = true;
      terminationError ??= error;
      // Keep the single-flight lease until `close`: kill() only requests
      // termination. A successful SIGKILL also gives the process a bounded
      // grace period to report close before it is treated as terminated.
      try {
        child.kill("SIGKILL");
      } catch {
        // Ownership still remains with the reaper until `close` is observed.
      }
      closeTimer = setTimeout(
        () =>
          finish(
            new BackupProcessUnconfirmedTerminationError(
              terminationError?.message ?? "Database backup process did not close",
              closed,
            ),
          ),
        PROCESS_CLOSE_TIMEOUT_MS,
      );
    };
    const abort = () => terminate(new Error("Database backup process cancelled"));
    const timer = setTimeout(() => {
      terminate(new Error("Database backup process timed out"));
    }, timeoutMs);
    child.stderr?.resume();
    child.stdout?.on("data", (chunk) => {
      if (stdout.length < 10_000) stdout += chunk.toString();
    });
    child.once("spawn", () => {
      spawned = true;
    });
    child.once("error", (error) => {
      if (!spawned) {
        markClosed();
        finish(error);
      }
      else terminate(error);
    });
    child.once("close", (code, childSignal) => {
      markClosed();
      if (terminationError) finish(terminationError);
      else if (code === 0) finish();
      else finish(new Error(`Database backup process failed (${code ?? childSignal})`));
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export interface BackupArtifact {
  filename: string;
  path: string;
  size: number;
  dispose(): Promise<void>;
}

interface BackupServiceOptions {
  databaseUrl?: () => string | undefined;
  now?: () => Date;
  run?: ProcessRunner;
  tempRoot?: string;
  verifyTools?: () => Promise<void>;
}

function defaultBackupTempRoot(): string {
  if (process.platform !== "win32") return "/tmp/padelclash-backups";
  return `${process.env.TEMP ?? "C:\\Windows\\Temp"}\\padelclash-backups`;
}

export function isPostgres17Version(output: string): boolean {
  return /\(PostgreSQL\) 17\./.test(output);
}

export async function verifyPostgres17Tools(
  timeoutMs = TOOL_VERSION_TIMEOUT_MS,
  startProcess?: StartProcess,
) {
  for (const command of ["pg_dump", "pg_restore"] as const) {
    let output: string;
    try {
      output = await runDatabaseBackupProcess(
        {
          command,
          args: ["--version"],
          captureOutput: true,
          env: { ...process.env },
          timeoutMs,
        },
        startProcess,
      );
    } catch (error) {
      if (error instanceof BackupProcessUnconfirmedTerminationError) throw error;
      throw new BackupGenerationError();
    }
    if (!isPostgres17Version(output)) throw new BackupGenerationError();
  }
}

export function createDatabaseBackupService({
  databaseUrl = () => process.env.DATABASE_URL,
  now = () => new Date(),
  run = runDatabaseBackupProcess,
  tempRoot = defaultBackupTempRoot(),
  verifyTools = verifyPostgres17Tools,
}: BackupServiceOptions = {}) {
  let generating = false;
  const liveRequestDirectories = new Set<string>();

  async function purgeOrphanedArtifacts() {
    await mkdir(/* turbopackIgnore: true */ tempRoot, {
      recursive: true,
      mode: 0o700,
    });
    await chmod(/* turbopackIgnore: true */ tempRoot, 0o700);
    const entries = await readdir(/* turbopackIgnore: true */ tempRoot, {
      withFileTypes: true,
    });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(REQUEST_PREFIX))
        .map(async (entry) => {
          const path = join(/* turbopackIgnore: true */ tempRoot, entry.name);
          if (!liveRequestDirectories.has(path)) {
            await rm(/* turbopackIgnore: true */ path, {
              recursive: true,
              force: true,
            });
          }
        }),
    );
  }

  async function generate(signal?: AbortSignal): Promise<BackupArtifact> {
    if (generating) throw new BackupBusyError();
    generating = true;
    let requestDirectory: string | undefined;
    let ownershipTransferred = false;
    try {
      const generatedAt = now();
      await purgeOrphanedArtifacts();
      await verifyTools();
      requestDirectory = await mkdtemp(
        join(/* turbopackIgnore: true */ tempRoot, REQUEST_PREFIX),
      );
      liveRequestDirectories.add(requestDirectory);
      await chmod(/* turbopackIgnore: true */ requestDirectory, 0o700);
      const stamp = generatedAt
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
      const filename = `padelclash-${stamp}.dump`;
      const archivePath = join(
        /* turbopackIgnore: true */ requestDirectory,
        filename,
      );
      const connection = databaseUrl();
      if (!connection) throw new BackupGenerationError();
      const env = { ...process.env };
      delete env.DATABASE_URL;
      Object.assign(env, databaseUrlToLibpqEnv(connection));

      await run({
        command: "pg_dump",
        args: [
          "--format=custom",
          "--no-acl",
          "--no-owner",
          "--lock-wait-timeout=5s",
          "--file",
          archivePath,
        ],
        env,
        signal,
        timeoutMs: PROCESS_TIMEOUT_MS,
      });
      await access(/* turbopackIgnore: true */ archivePath, constants.R_OK);
      const { size } = await stat(/* turbopackIgnore: true */ archivePath);
      if (size === 0) throw new BackupGenerationError();
      await run({
        command: "pg_restore",
        args: ["--list", archivePath],
        env,
        signal,
        timeoutMs: PROCESS_TIMEOUT_MS,
      });

      let disposed = false;
      return {
        filename,
        path: archivePath,
        size,
        async dispose() {
          if (disposed) return;
          disposed = true;
          try {
            await rm(/* turbopackIgnore: true */ requestDirectory!, {
              recursive: true,
              force: true,
            });
          } finally {
            liveRequestDirectories.delete(requestDirectory!);
          }
        },
      };
    } catch (error) {
      if (error instanceof BackupProcessUnconfirmedTerminationError) {
        ownershipTransferred = true;
        const ownedDirectory = requestDirectory;
        void error.closed
          .then(async () => {
            if (!ownedDirectory) return;
            await rm(/* turbopackIgnore: true */ ownedDirectory, {
              recursive: true,
              force: true,
            }).catch(() => {});
            liveRequestDirectories.delete(ownedDirectory);
          })
          .finally(() => {
            generating = false;
          });
        throw new BackupGenerationError();
      }
      if (requestDirectory) {
        await rm(/* turbopackIgnore: true */ requestDirectory, {
          recursive: true,
          force: true,
        }).catch(() => {});
        liveRequestDirectories.delete(requestDirectory);
      }
      if (error instanceof BackupBusyError || error instanceof BackupGenerationError) {
        throw error;
      }
      throw new BackupGenerationError();
    } finally {
      if (!ownershipTransferred) generating = false;
    }
  }

  return { generate, isBusy: () => generating };
}

export const databaseBackupService = createDatabaseBackupService();
