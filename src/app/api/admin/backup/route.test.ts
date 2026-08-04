import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import type { BackupArtifact } from "../../../../services/database-backup";
import { BackupBusyError } from "../../../../services/database-backup";
import { createBackupPostHandler } from "./route";

async function fixtureArtifact(): Promise<BackupArtifact> {
  const directory = join(tmpdir(), `padelclash-route-test-${crypto.randomUUID()}`);
  const path = join(directory, "padelclash-20260804T123456Z.dump");
  await mkdir(directory, { recursive: true });
  await writeFile(path, "validated archive");
  return {
    filename: "padelclash-20260804T123456Z.dump",
    path,
    size: 17,
    dispose: vi.fn(async () => {
      const { rm } = await import("node:fs/promises");
      await rm(directory, { recursive: true, force: true });
    }),
  };
}

const request = (origin = "https://padel.example") =>
  new Request("https://padel.example/api/admin/backup", {
    method: "POST",
    headers: { origin },
  });

const browserRequestWithoutOrigin = () =>
  new Request("https://padel.example/api/admin/backup", {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin" },
  });

describe("POST /api/admin/backup", () => {
  it("refuses unauthenticated and cross-origin requests before generation", async () => {
    const generate = vi.fn();
    const unauthenticated = createBackupPostHandler({
      isAdmin: async () => false,
      generate,
    });
    expect((await unauthenticated(request())).status).toBe(401);
    expect(generate).not.toHaveBeenCalled();

    const crossOrigin = createBackupPostHandler({
      isAdmin: async () => true,
      generate,
    });
    expect((await crossOrigin(request("https://attacker.example"))).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it("streams a strict UTC attachment with no-store and cleans up on completion", async () => {
    const artifact = await fixtureArtifact();
    const handler = createBackupPostHandler({
      isAdmin: async () => true,
      generate: async () => artifact,
    });

    const response = await handler(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="padelclash-20260804T123456Z.dump"',
    );
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("validated archive");
    await vi.waitFor(async () => expect(() => access(artifact.path)).rejects.toThrow());
  });

  it("accepts a browser-protected same-origin signal when Origin is omitted", async () => {
    const artifact = await fixtureArtifact();
    const handler = createBackupPostHandler({
      isAdmin: async () => true,
      generate: async () => artifact,
    });

    const response = await handler(browserRequestWithoutOrigin());
    expect(response.status).toBe(200);
    await response.body!.cancel();
  });

  it("compares Origin with the public forwarded target behind a proxy", async () => {
    const artifact = await fixtureArtifact();
    const handler = createBackupPostHandler({
      isAdmin: async () => true,
      generate: async () => artifact,
    });
    const proxiedRequest = new Request("http://app:3000/api/admin/backup", {
      method: "POST",
      headers: {
        origin: "https://padel.example",
        "x-forwarded-host": "padel.example",
        "x-forwarded-proto": "https",
      },
    });

    const response = await handler(proxiedRequest);
    expect(response.status).toBe(200);
    await response.body!.cancel();
  });

  it("cleans up when delivery is cancelled", async () => {
    const artifact = await fixtureArtifact();
    const handler = createBackupPostHandler({
      isAdmin: async () => true,
      generate: async () => artifact,
    });
    const response = await handler(request());

    await response.body!.cancel();

    await vi.waitFor(() => expect(artifact.dispose).toHaveBeenCalledOnce());
  });

  it("returns a retryable sanitized refusal when generation is busy", async () => {
    const handler = createBackupPostHandler({
      isAdmin: async () => true,
      generate: async () => {
        throw new BackupBusyError();
      },
    });

    const response = await handler(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "A database backup is already being prepared. Please retry shortly.",
    });
  });
});
