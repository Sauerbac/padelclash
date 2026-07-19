"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  QUEUE_CHANGED_EVENT,
  listQueuedMatches,
  removeQueuedMatch,
  type QueuedMatch,
} from "@/lib/offline-queue";

// Client-side sibling of MatchCard's format — pending cards only ever render
// on the device that queued them, so device-local time is the right zone.
const playedAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * "Pending sync" markers in the logger's local feed (spec "PWA & offline"):
 * matches waiting in the offline queue, rendered above the synced feed.
 * Queued variant of MatchCard: dashed gold border, no deltas yet.
 */
export function QueuedMatches() {
  const [queued, setQueued] = useState<QueuedMatch[]>([]);

  const load = useCallback(() => {
    listQueuedMatches()
      .then((matches) => setQueued(matches.reverse())) // newest first, like the feed
      .catch(() => setQueued([]));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(QUEUE_CHANGED_EVENT, load);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, load);
  }, [load]);

  if (queued.length === 0) return null;

  return (
    <div className="space-y-3">
      {queued.map((match) => (
        <QueuedMatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}

function QueuedMatchCard({ match }: { match: QueuedMatch }) {
  const winners = match.names[match.winnerSide];
  const losers = match.names[match.winnerSide === "A" ? "B" : "A"];
  const setsText = match.sets
    ?.map((s) =>
      match.winnerSide === "A" ? `${s.a}–${s.b}` : `${s.b}–${s.a}`,
    )
    .join(", ");

  return (
    <article className="border border-dashed border-accent px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-semibold uppercase">
          {winners.join(" & ")}
          <span className="font-medium text-muted-foreground lowercase">
            {" "}
            def.{" "}
          </span>
          <span className="text-muted-foreground">{losers.join(" & ")}</span>
        </p>
        <Badge variant="pending">Pending sync</Badge>
      </div>
      <p className="mt-1 font-mono text-xs font-medium text-muted-foreground">
        {playedAtFormat.format(new Date(match.playedAt))}
        {setsText && <> · {setsText}</>}
      </p>
      {match.syncError && (
        <div className="mt-2.5 space-y-2.5">
          <Alert variant="destructive">
            Couldn&apos;t sync: {match.syncError}
          </Alert>
          <ConfirmDialog
            trigger={
              <Button variant="destructive" size="xs">
                Discard
              </Button>
            }
            title="Discard this queued match?"
            description="It never reached the server — discarding removes it from this device for good."
            confirmLabel="Discard"
            onConfirm={() => removeQueuedMatch(match.id)}
          />
        </div>
      )}
    </article>
  );
}
