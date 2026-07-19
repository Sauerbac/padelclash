"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className="border-dashed">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{winners.join(" & ")}</span>
              <span className="text-muted-foreground"> def. </span>
              <span className="font-medium">{losers.join(" & ")}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {playedAtFormat.format(new Date(match.playedAt))}
              {setsText && <> · {setsText}</>}
            </p>
          </div>
          <Badge variant="outline">Pending sync</Badge>
        </div>
        {match.syncError && (
          <div className="space-y-2">
            <p className="text-xs text-destructive">
              Couldn&apos;t sync: {match.syncError}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (window.confirm("Discard this queued match for good?")) {
                  removeQueuedMatch(match.id);
                }
              }}
            >
              Discard
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
