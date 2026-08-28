"use client";

import { Button } from "@/components/ui/button";

export function ConnectionStatus({
  refreshedAt,
  message = "Connection is poor",
  showRetry = false,
}: {
  refreshedAt?: Date;
  message?: string;
  showRetry?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-l-2 border-accent pl-3 font-mono text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase"
    >
      <span className="text-accent">{message}</span>
      {refreshedAt && <> · Saved view refreshed {refreshedAt.toLocaleString()}</>}
      {showRetry && (
        <Button type="button" variant="link" size="xs" className="ml-2 h-auto p-0 text-foreground" onClick={() => window.location.reload()}>
          Retry
        </Button>
      )}
    </div>
  );
}
