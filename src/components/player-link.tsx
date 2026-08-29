"use client";

import Link from "next/link";
import { useState } from "react";
import { usePlayerNavigationState } from "@/components/player-navigation-context";

/**
 * A player name as a tap target into the Player Detail drill-in
 * (spec "Screens") — the one styling for it, wherever a name renders:
 * a border-toned underline that warms to gold on hover.
 */
export function PlayerLink({
  playerId,
  children,
}: {
  playerId: string;
  children: React.ReactNode;
}) {
  const { needsConnection, explanationPreview } = usePlayerNavigationState();
  const [explanation, setExplanation] = useState(explanationPreview);
  return (
    <>
      <Link
        href={`/players/${playerId}`}
        onClick={(event) => {
          if (!needsConnection) return;
          event.preventDefault();
          setExplanation(true);
        }}
        className="underline decoration-border underline-offset-3 hover:decoration-accent"
      >
        {children}
      </Link>
      {explanation && (
        <span role="status" className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md border bg-plate p-3 text-sm font-semibold text-foreground shadow-lg">
          Player Detail needs a server connection. Your Saved View remains open.
        </span>
      )}
    </>
  );
}
