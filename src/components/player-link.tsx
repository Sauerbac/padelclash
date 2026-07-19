import Link from "next/link";

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
  return (
    <Link
      href={`/players/${playerId}`}
      className="underline decoration-border underline-offset-3 hover:decoration-accent"
    >
      {children}
    </Link>
  );
}
