import { describe, expect, it, vi } from "vitest";
import {
  backupFilenameFromDisposition,
  requestDatabaseBackup,
} from "./database-backup-download";

describe("database backup download", () => {
  it("uses the strict attachment filename and forwards the archive to the saver", async () => {
    const archive = new Blob(["archive"]);
    const fetcher = vi.fn(async () =>
      new Response(archive, {
        headers: {
          "Content-Disposition":
            'attachment; filename="padelclash-20260804T123456Z.dump"',
        },
      }),
    );
    const save = vi.fn();

    await requestDatabaseBackup(fetcher, save);

    expect(fetcher).toHaveBeenCalledWith("/api/admin/backup", {
      method: "POST",
      credentials: "same-origin",
    });
    expect(save).toHaveBeenCalledWith(
      expect.any(Blob),
      "padelclash-20260804T123456Z.dump",
    );
  });

  it("returns only a concise server failure", async () => {
    await expect(
      requestDatabaseBackup(
        async () =>
          Response.json(
            { error: "Database backup could not be prepared. Please try again." },
            { status: 500 },
          ),
        vi.fn(),
      ),
    ).rejects.toThrow("Database backup could not be prepared. Please try again.");
  });

  it("rejects a malformed attachment filename", () => {
    expect(() =>
      backupFilenameFromDisposition('attachment; filename="private.txt"'),
    ).toThrow("The backup response was invalid.");
  });
});
