"use client";

import { useEffect, useState, useTransition } from "react";
import {
  generateGeneralLinkAction,
  revokeGeneralLinkAction,
} from "@/app/actions/admin";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  CopyLinkButton,
  copyInvitationLink,
} from "@/components/admin/copy-link-button";
import type { LinkDetails } from "@/services/onboarding";

export interface GeneralLinkActions {
  generate?: typeof generateGeneralLinkAction;
  revoke?: typeof revokeGeneralLinkAction;
}

/**
 * The circle's one General Onboarding Link (spec decisions 29, 36 and 50).
 * While one is live it can only be copied or revoked — generating another is
 * refused by the server, so the button isn't offered either.
 */
export function GeneralLinkControl({
  link,
  msRemaining,
  actions,
}: {
  link: LinkDetails | null;
  /**
   * Milliseconds left at render time, measured on the server. Passed in rather
   * than derived from `expiresAt` here so the countdown is anchored to the
   * clock that actually decides validity — an Admin phone running twenty
   * minutes fast would otherwise be told a live link had expired.
   */
  msRemaining: number | null;
  /** Gallery stubs; production uses the imported server actions. */
  actions?: GeneralLinkActions;
}) {
  const generateGeneralLink =
    actions?.generate ?? generateGeneralLinkAction;
  const revokeGeneralLink = actions?.revoke ?? revokeGeneralLinkAction;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const remaining = useCountdown(msRemaining);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "That didn't work.");
    });
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateGeneralLink();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await copyInvitationLink(`/join/${result.link.token}`);
    });
  }

  // The server refuses to generate a second link while one is live, so the
  // card offers exactly the controls the current state allows. Once the clock
  // runs out the link is dead server-side whether or not this page reloaded —
  // so treat "live but expired" as no link at all rather than showing a Copy
  // button for a token that would only produce a Dead link screen.
  const live = link !== null && remaining !== "expired";

  return (
    <div className="border p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="section-label">General invite link</h3>
        {live && remaining && (
          <span className="font-mono text-xs font-semibold text-accent">
            {remaining}
          </span>
        )}
      </div>

      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        {live ? (
          <>
            Anyone holding it can join as an unclaimed player — or add
            themselves — and log matches. Share it for the evening, not forever.
          </>
        ) : link ? (
          "That link has run out. Generate a new one if there's another evening to onboard."
        ) : (
          "No link right now. Generate one for an onboarding evening; it expires after 12 hours, and you can kill it sooner."
        )}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {live ? (
          <>
            <CopyLinkButton path={`/join/${link.token}`} label="Copy link" />
            <ConfirmDialog
              trigger={
                <Button variant="destructive" size="xs" disabled={pending}>
                  Revoke
                </Button>
              }
              title="Revoke the general invite link?"
              description="Anyone still holding it loses the ability to join — including whoever it's already been forwarded to. Players who joined with it keep their access."
              confirmLabel="Revoke"
              onConfirm={() => run(revokeGeneralLink)}
            />
          </>
        ) : (
          <Button
            variant="chip"
            size="xs"
            disabled={pending}
            onClick={generate}
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

const TICK_MS = 30_000;

/**
 * Ticking "time left" for a live link. A 12-hour window is short enough that
 * an Admin reading "expires 21:30" still has to do arithmetic under pressure
 * during an onboarding evening; "4h 12m left" doesn't.
 *
 * Counts down from the server's measurement by tracking elapsed time since
 * mount, rather than re-reading the wall clock. Two things fall out of that:
 * the first render is identical on server and client, so there is nothing to
 * mismatch during hydration; and the result never depends on the device's
 * clock being right.
 */
function useCountdown(msRemaining: number | null): string | null | "expired" {
  // Keyed by the server's measurement: when a new link is generated the key
  // changes and the elapsed time reads as zero again. Without that, a fresh
  // 12-hour link would inherit the previous one's accumulated elapsed time
  // and could render as already expired the moment it appeared.
  const [tick, setTick] = useState<{ key: number | null; elapsed: number }>({
    key: msRemaining,
    elapsed: 0,
  });

  useEffect(() => {
    if (msRemaining === null) return;
    // Measured as a difference between two readings on the same device, so a
    // throttled or coalesced timer cannot make the countdown drift: a
    // backgrounded tab that fires the interval twice in an hour still reports
    // the full hour. Counting callbacks instead would under-report elapsed
    // time and leave a dead link showing as live.
    const startedAt = Date.now();
    const timer = setInterval(
      () => setTick({ key: msRemaining, elapsed: Date.now() - startedAt }),
      TICK_MS,
    );
    return () => clearInterval(timer);
  }, [msRemaining]);

  if (msRemaining === null) return null;

  const elapsed = tick.key === msRemaining ? tick.elapsed : 0;
  const ms = msRemaining - elapsed;
  if (ms <= 0) return "expired";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;
  return `${Math.max(minutes, 1)}m left`;
}
