import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { PlayerLink } from "@/components/player-link";
import { cn } from "@/lib/utils";

/**
 * One rankings row (design "LeaderboardRow"), a semantic table row. #1 gets
 * the gold left rail on a tinted fill; unranked players get a dashed frame,
 * muted text and "—" for the rank.
 */
export function LeaderboardRow({
  rank,
  playerId,
  name,
  rating,
  wins,
  losses,
  isYou,
}: {
  rank: number | null;
  playerId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  isYou: boolean;
}) {
  const top = rank === 1;
  const unranked = rank === null;
  // The row frame, carried by every cell (row borders don't render with
  // border-separate): a 1px box by default, gold rail + tinted fill for #1,
  // dashed for unranked.
  const frame = cn(
    "border-y first:border-l last:border-r",
    top &&
      "border-transparent bg-secondary py-3.5 first:border-l-[3px] first:border-l-accent",
    unranked && "border-dashed",
  );
  return (
    <TableRow className={cn(unranked && "text-muted-foreground")}>
      <TableCell
        className={cn(
          frame,
          "w-9 font-display text-[22px]",
          top ? "text-accent" : "text-muted-foreground",
        )}
      >
        {rank ?? "—"}
      </TableCell>
      <TableCell
        className={cn(frame, "w-full text-[19px] font-semibold uppercase")}
      >
        <PlayerLink playerId={playerId}>{name}</PlayerLink>
        {isYou && (
          <Badge variant="you" className="ml-2 align-middle text-[10px]">
            You
          </Badge>
        )}
      </TableCell>
      <TableCell
        className={cn(
          frame,
          "pl-3 text-right font-mono text-[15px] font-semibold",
        )}
      >
        {Math.round(rating)}
      </TableCell>
      <TableCell
        className={cn(
          frame,
          "pl-3 text-right font-mono text-[13px] font-medium text-muted-foreground",
        )}
      >
        {wins}–{losses}
      </TableCell>
    </TableRow>
  );
}
