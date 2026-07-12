import Link from "next/link";

/**
 * A player name as a tap target into the Player Detail drill-in
 * (spec "Screens") — the one styling for it, wherever a name renders.
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
      className="underline-offset-2 hover:underline"
    >
      {children}
    </Link>
  );
}
