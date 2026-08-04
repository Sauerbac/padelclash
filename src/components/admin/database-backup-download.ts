const BACKUP_NAME = /^padelclash-\d{8}T\d{6}Z\.dump$/;

export function backupFilenameFromDisposition(header: string | null): string {
  const match = header?.match(/(?:^|;)\s*filename="([^"]+)"(?:;|$)/i);
  if (!match || !BACKUP_NAME.test(match[1])) {
    throw new Error("The backup response was invalid.");
  }
  return match[1];
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
type Saver = (archive: Blob, filename: string) => void;

export async function requestDatabaseBackup(fetcher: Fetcher, save: Saver) {
  const response = await fetcher("/api/admin/backup", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : "Database backup could not be prepared. Please try again.",
    );
  }
  const filename = backupFilenameFromDisposition(
    response.headers.get("Content-Disposition"),
  );
  save(await response.blob(), filename);
}

export function saveBackupInBrowser(archive: Blob, filename: string) {
  const url = URL.createObjectURL(archive);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
