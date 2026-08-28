"use client";

import Link from "next/link";
import { usePlayerNavigationNeedsConnection } from "@/components/player-navigation-context";

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
  const needsConnection = usePlayerNavigationNeedsConnection();
  return (
    <Link
      href={`/players/${playerId}`}
      onClick={(event) => {
        if (!needsConnection) return;
        event.preventDefault();
        window.alert("Player Detail needs a connection. Your Saved View is still open.");
      }}
      className="underline decoration-border underline-offset-3 hover:decoration-accent"
    >
      {children}
    </Link>
  );
}
