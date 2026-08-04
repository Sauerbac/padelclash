import { open, type FileHandle } from "node:fs/promises";
import { isAdmin as realIsAdmin } from "../../../../services/auth/admin";
import {
  BackupBusyError,
  databaseBackupService,
  type BackupArtifact,
} from "../../../../services/database-backup";

export const runtime = "nodejs";

interface BackupRouteDependencies {
  isAdmin?: () => Promise<boolean>;
  generate?: (signal?: AbortSignal) => Promise<BackupArtifact>;
}

function jsonError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const requestOrigin = new URL(request.url).origin;
      if (new URL(origin).origin === requestOrigin) return true;

      const forwardedHost = request.headers
        .get("x-forwarded-host")
        ?.split(",")[0]
        .trim();
      const host = forwardedHost || request.headers.get("host");
      const forwardedProtocol = request.headers
        .get("x-forwarded-proto")
        ?.split(",")[0]
        .trim();
      const protocol = forwardedProtocol || new URL(request.url).protocol.slice(0, -1);
      if (host && new URL(origin).origin === `${protocol}://${host}`) return true;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

function artifactStream(artifact: BackupArtifact): ReadableStream<Uint8Array> {
  let file: FileHandle | undefined;
  let position = 0;
  let closed = false;

  const finish = async () => {
    if (closed) return;
    closed = true;
    await file?.close().catch(() => {});
    await artifact.dispose().catch(() => {});
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        file ??= await open(/* turbopackIgnore: true */ artifact.path, "r");
        const buffer = Buffer.allocUnsafe(64 * 1024);
        const { bytesRead } = await file.read(buffer, 0, buffer.length, position);
        if (bytesRead === 0) {
          controller.close();
          await finish();
          return;
        }
        position += bytesRead;
        controller.enqueue(buffer.subarray(0, bytesRead));
      } catch (error) {
        await finish();
        controller.error(error);
      }
    },
    async cancel() {
      await finish();
    },
  });
}

export function createBackupPostHandler({
  isAdmin = realIsAdmin,
  generate = (signal) => databaseBackupService.generate(signal),
}: BackupRouteDependencies = {}) {
  return async function POST(request: Request): Promise<Response> {
    if (!(await isAdmin())) {
      return jsonError("Admin session required.", 401);
    }
    if (!isSameOrigin(request)) {
      return jsonError("Same-origin request required.", 403);
    }

    try {
      const artifact = await generate(request.signal);
      return new Response(artifactStream(artifact), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${artifact.filename}"`,
          "Content-Length": String(artifact.size),
          "Content-Type": "application/octet-stream",
        },
      });
    } catch (error) {
      if (error instanceof BackupBusyError) {
        return jsonError(
          "A database backup is already being prepared. Please retry shortly.",
          409,
        );
      }
      return jsonError(
        "Database backup could not be prepared. Please try again.",
        500,
      );
    }
  };
}

export const POST = createBackupPostHandler();
