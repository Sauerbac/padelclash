import { Badge } from "@/components/ui/badge";
import { PlayerLink } from "@/components/player-link";
import { cn } from "@/lib/utils";

export interface PodiumPlace {
  playerId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  isYou: boolean;
}

/**
 * The Rankings Top 3 stand (spec decision 65). It *replaces* rows 1–3 rather
 * than sitting above a complete table — in a circle of ~8–12 Players a
 * duplicated top three costs a third of the screen to say nothing twice. The
 * table below therefore starts at #4, and ranks stay absolute.
 *
 * #1 keeps the gold accent; #2 stays plain muted and only #3 carries a medal
 * colour. Plinth heights and numeral sizes do most of the ranking work.
 *
 * Render only with three ranked Players. Below that the plain table stands
 * alone, because a one-Player podium reads as breakage rather than as an
 * early state.
 */
export function Podium({
  places,
}: {
  places: [PodiumPlace, PodiumPlace, PodiumPlace];
}) {
  const [first, second, third] = places;
  return (
    // DOM order is 1-2-3 so it reads in rank order; `order` puts #1 on the
    // centre plinth visually.
    <div className="grid grid-cols-[1fr_1.15fr_1fr] items-end gap-2">
      <Plinth
        place={first}
        rank={1}
        className="order-2"
        rail="border-t-4 border-t-accent"
        numeral="text-[56px] leading-[0.8] text-accent"
        height="h-[104px] pb-4"
        nameSize="text-[clamp(17px,5.3vw,26px)]"
        statColor="text-accent"
      />
      <Plinth
        place={second}
        rank={2}
        className="order-1"
        rail="border-t-[3px] border-t-muted-foreground"
        numeral="text-[40px] leading-[0.8] text-muted-foreground"
        height="h-[74px] pb-3.5"
      />
      <Plinth
        place={third}
        rank={3}
        className="order-3"
        rail="border-t-[3px] border-t-podium-bronze"
        numeral="relative top-1 text-[34px] leading-none text-podium-bronze"
        height="h-[58px] pb-3.5"
      />
    </div>
  );
}

function Plinth({
  place,
  rank,
  className,
  rail,
  numeral,
  height,
  nameSize = "text-[clamp(17px,5vw,22px)]",
  statColor = "text-muted-foreground",
}: {
  place: PodiumPlace;
  rank: number;
  className: string;
  rail: string;
  numeral: string;
  height: string;
  nameSize?: string;
  statColor?: string;
}) {
  return (
    // Responsive type keeps ordinary long names on one line; balanced wrapping
    // is the backstop for names that still cannot fit their third of the row.
    <div
      className={cn("min-w-0 text-center break-words text-balance", className)}
    >
      {rank === 1 && (
        <p className="font-mono text-[10px] font-semibold tracking-[2px] text-accent uppercase">
          Top dog
        </p>
      )}
      {/* Inline, not flex: a flex item won't shrink below its content, so
          a long name would push out of the column instead of breaking.
          Inline flow lets the badge wrap to its own line, and `break-words`
          on the wrapper break a name too long to fit at all. */}
      <p className={cn("mt-0.5 font-display leading-none uppercase", nameSize)}>
        <PlayerLink playerId={place.playerId}>{place.name}</PlayerLink>
        {/* The "You" badge follows the viewer onto the stand — otherwise it
            would vanish with the table row that used to carry it. */}
        {place.isYou && (
          <Badge
            variant="you"
            className="ml-1.5 align-middle text-[9px] tracking-[1px]"
          >
            You
          </Badge>
        )}
      </p>
      <p className={cn("mt-0.5 font-mono text-xs font-medium", statColor)}>
        {place.rating} · {place.wins}–{place.losses}
      </p>
      <div
        className={cn(
          "mt-2 flex flex-col items-center justify-end bg-secondary pt-3",
          rail,
          height,
        )}
      >
        <span className={cn("font-display", numeral)}>
          {rank}
        </span>
      </div>
    </div>
  );
}
