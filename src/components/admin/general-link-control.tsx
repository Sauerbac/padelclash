"use client";

import { useState, useTransition } from "react";
import {
  generateGeneralLinkAction,
  revokeGeneralLinkAction,
} from "@/app/actions/admin";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import type { LinkDetails } from "@/services/onboarding";

/**
 * The circle's one General Onboarding Link (spec decisions 29, 36 and 50).
 * While one is live it can only be copied or revoked — generating another is
 * refused by the server, so the button isn't offered either.
 */
export function GeneralLinkControl({ link }: { link: LinkDetails | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "That didn't work.");
    });
  }

  return (
    <div className="border p-3.5">
      <h3 className="section-label">General invite link</h3>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        {link ? (
          <>
            Live until{" "}
            <span className="text-foreground">{formatExpiry(link.expiresAt)}</span>
            . Anyone with it can join as an unclaimed player — or add
            themselves — and log matches. Share it for the evening, not forever.
          </>
        ) : (
          "No link right now. Generate one for an onboarding evening; it expires after 12 hours."
        )}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {link ? (
          <>
            <CopyLinkButton path={`/join/${link.token}`} label="Copy link" />
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="xs" disabled={pending}>
                  Revoke
                </Button>
              }
              title="Revoke the general invite link?"
              description="Anyone still holding it loses the ability to join. Players who already joined keep their access."
              confirmLabel="Revoke"
              onConfirm={() => run(revokeGeneralLinkAction)}
            />
          </>
        ) : (
          <Button
            variant="chip"
            size="xs"
            disabled={pending}
            onClick={() => run(generateGeneralLinkAction)}
          >
            {pending ? "Generating…" : "Generate link"}
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-2.5">
          <Alert variant="destructive">{error}</Alert>
        </div>
      )}
    </div>
  );
}

const expiryFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function formatExpiry(date: Date): string {
  return expiryFormat.format(new Date(date));
}
