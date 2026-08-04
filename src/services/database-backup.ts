import {
  execFile,
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
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
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

type LibpqEnv = Record<string, string> & {
  PGDATABASE: string;
  PGHOST: string;
  PGPASSWORD: string;
  PGPORT: string;
  PGUSER: string;
};

export function databaseUrlToLibpqEnv(connectionString: string): LibpqEnv {
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
}

type ProcessRunner = (request: ProcessRequest) => Promise<void>;
type StartProcess = (
  command: "pg_dump" | "pg_restore",
  args: string[],
  options: SpawnOptions,
) => ChildProcess;

export async function runDatabaseBackupProcess(
  { command, args, env, signal, timeoutMs }: ProcessRequest,
  startProcess: StartProcess = (literalCommand, literalArgs, options) =>
    literalCommand === "pg_dump"
      ? spawn("pg_dump", literalArgs, options)
      : spawn("pg_restore", literalArgs, options),
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const options = {
      env,
      shell: false,
      stdio: ["ignore", "ignore", "pipe"] as ["ignore", "ignore", "pipe"],
      windowsHide: true,
    };
    // Literal executable names keep Next's production file tracer scoped. A
    // dynamic spawn target makes it conservatively trace the whole repository.
    const child = startProcess(command, args, options);
    let settled = false;
    let spawned = false;
    let terminationError: Error | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    const terminate = (error: Error) => {
      if (terminationError || settled) return;
      terminationError = error;
      // Keep the single-flight lease until `close`: kill() only requests
      // termination, and the child may still hold the archive open afterward.
      child.kill("SIGKILL");
    };
    const abort = () => terminate(new Error("Database backup process cancelled"));
    const timer = setTimeout(() => {
      terminate(new Error("Database backup process timed out"));
    }, timeoutMs);
    child.stderr?.resume();
    child.once("spawn", () => {
      spawned = true;
    });
    child.once("error", (error) => {
      if (!spawned) finish(error);
      else terminationError ??= error;
    });
    child.once("close", (code, childSignal) => {
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

async function verifyPostgres17Tools() {
  const version = (command: "pg_dump" | "pg_restore") =>
    new Promise<string>((resolve, reject) => {
      const callback = (error: Error | null, stdout: string) => {
        if (error) reject(error);
        else resolve(stdout);
      };
      if (command === "pg_dump") {
        execFile("pg_dump", ["--version"], { windowsHide: true }, callback);
      } else {
        execFile("pg_restore", ["--version"], { windowsHide: true }, callback);
      }
    }).catch(() => "");

  for (const command of ["pg_dump", "pg_restore"] as const) {
    const output = await version(command);
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

  async function purgeStaleArtifacts(currentTime: Date) {
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
          const details = await stat(/* turbopackIgnore: true */ path);
          if (currentTime.getTime() - details.mtimeMs > STALE_AFTER_MS) {
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
    try {
      const generatedAt = now();
      await purgeStaleArtifacts(generatedAt);
      await verifyTools();
      requestDirectory = await mkdtemp(
        join(/* turbopackIgnore: true */ tempRoot, REQUEST_PREFIX),
      );
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
          await rm(/* turbopackIgnore: true */ requestDirectory!, {
            recursive: true,
            force: true,
          });
        },
      };
    } catch (error) {
      if (requestDirectory) {
        await rm(/* turbopackIgnore: true */ requestDirectory, {
          recursive: true,
          force: true,
        }).catch(() => {});
      }
      if (error instanceof BackupBusyError || error instanceof BackupGenerationError) {
        throw error;
      }
      throw new BackupGenerationError();
    } finally {
      generating = false;
    }
  }

  return { generate, isBusy: () => generating };
}

export const databaseBackupService = createDatabaseBackupService();
