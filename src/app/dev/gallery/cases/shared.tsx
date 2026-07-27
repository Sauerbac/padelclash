import type { PayoffDelta } from "@/app/actions/matches";
import { FEED, NOW, YOU } from "../feed/fixtures";

export { FEED, NOW, YOU };

export const LONG = {
  id: "22222222-2222-7222-8222-222222222222",
  name: "Bartholomew Fitzgerald-Huang",
};
export const CASEY = {
  id: "44444444-4444-7444-8444-444444444444",
  name: "Casey",
};
export const INGRID = {
  id: "55555555-5555-7555-8555-555555555555",
  name: "Ingrid",
};
export const ROSTER = [YOU, LONG, CASEY, INGRID];
export const RESERVED_NAMES = ROSTER.map((player) => player.name);

export const PAYOFF: PayoffDelta[] = [
  {
    playerId: YOU.id,
    name: YOU.name,
    side: "A",
    ratingBefore: 1300,
    delta: 15,
    ratingAfter: 1315,
  },
  {
    playerId: CASEY.id,
    name: CASEY.name,
    side: "B",
    ratingBefore: 1065,
    delta: -15,
    ratingAfter: 1050,
  },
];

export function inert(children: React.ReactNode) {
  return (
    <div inert className="contents">
      {children}
    </div>
  );
}
