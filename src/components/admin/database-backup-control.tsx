"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  requestDatabaseBackup,
  saveBackupInBrowser,
} from "./database-backup-download";

export type DatabaseBackupState = "idle" | "preparing" | "failure";
export type DownloadDatabaseBackup = () => Promise<void>;

async function realDownloadDatabaseBackup() {
  await requestDatabaseBackup(fetch, saveBackupInBrowser);
}

export function DatabaseBackupControl({
  download = realDownloadDatabaseBackup,
  initialState = "idle",
  initialError = "Database backup could not be prepared. Please try again.",
}: {
  download?: DownloadDatabaseBackup;
  initialState?: DatabaseBackupState;
  initialError?: string;
} = {}) {
  const [state, setState] = useState<DatabaseBackupState>(initialState);
  const [error, setError] = useState(initialError);

  const startDownload = async () => {
    setState("preparing");
    try {
      await download();
      setState("idle");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Database backup could not be prepared. Please try again.",
      );
      setState("failure");
    }
  };

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold text-muted-foreground">
        This archive contains all private PadelClash data. Keep it only on an
        encrypted device.
      </p>
      <Button
        type="button"
        disabled={state === "preparing"}
        aria-busy={state === "preparing"}
        onClick={startDownload}
        data-database-backup
      >
        {state === "preparing" ? "Preparing backup…" : "Download backup"}
      </Button>
      {state === "failure" && (
        <Alert variant="destructive">
          {error} Use Download backup to retry.
        </Alert>
      )}
    </div>
  );
}
