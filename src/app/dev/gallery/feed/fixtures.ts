import type { MatchSyncRefusal } from "@/domain/sync-policy";
import type {
  IncompatibleQueuedMatch,
  QueuedMatch,
} from "@/services/offline/queue";
import type { FeedMatch } from "@/services/matches";

/**
 * Feed fixtures — hand-written literals, not replay-engine output (decision
 * 128). They exist to stress layout, so they are deliberately abusive: names
 * that wrap twice at 320px, three-digit deltas, five sets, a guest on a winning
 * side. They do not add up to a plausible rating history and are not meant to.
 */

/** Frozen "now" so every case renders identically on every reload. */
export const NOW = new Date("2026-07-27T21:00:00Z");

const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 60 * 60 * 1000);

export const YOU = { id: "11111111-1111-7111-8111-111111111111", name: "Simon" };

const LONG = {
  id: "22222222-2222-7222-8222-222222222222",
  name: "Bartholomew Fitzgerald-Huang",
};
const ALSO_LONG = {
  id: "33333333-3333-7333-8333-333333333333",
  name: "Anastasia Vandenberghe-Oyelaran",
};
const CASEY = { id: "44444444-4444-7444-8444-444444444444", name: "Casey" };
const RETIRED = {
  id: "55555555-5555-7555-8555-555555555555",
  name: "Ingrid",
};

/**
 * A doubles match with the worst content the layout can be handed: four
 * players, two of them long enough to wrap, five sets, and deltas at three
 * digits. If the card survives this at 320px it survives the real feed.
 */
const doublesFiveSets: FeedMatch = {
  id: "aaaaaaaa-0001-7000-8000-000000000000",
  playedAt: hoursAgo(2),
  loggedAt: hoursAgo(2),
  loggedBy: YOU.id,
  loggedByName: YOU.name,
  winnerSide: "A",
  sets: [
    { a: 6, b: 4 },
    { a: 3, b: 6 },
    { a: 7, b: 5 },
    { a: 4, b: 6 },
    { a: 7, b: 6 },
  ],
  participants: [
    { kind: "player", playerId: YOU.id, name: YOU.name, side: "A", slot: 0, ratingBefore: 1300, delta: 187, ratingAfter: 1487 },
    { kind: "player", playerId: LONG.id, name: LONG.name, side: "A", slot: 1, ratingBefore: 1210, delta: 104, ratingAfter: 1314 },
    { kind: "player", playerId: ALSO_LONG.id, name: ALSO_LONG.name, side: "B", slot: 0, ratingBefore: 1400, delta: -187, ratingAfter: 1213 },
    { kind: "player", playerId: CASEY.id, name: CASEY.name, side: "B", slot: 1, ratingBefore: 1050, delta: -104, ratingAfter: 946 },
  ],
};

/** The floor: singles, Simple Result, no set row at all. */
const singlesSimple: FeedMatch = {
  id: "aaaaaaaa-0002-7000-8000-000000000000",
  playedAt: hoursAgo(30),
  loggedAt: hoursAgo(30),
  loggedBy: CASEY.id,
  loggedByName: CASEY.name,
  winnerSide: "B",
  sets: null,
  participants: [
    { kind: "player", playerId: YOU.id, name: YOU.name, side: "A", slot: 0, ratingBefore: 1315, delta: -15, ratingAfter: 1300 },
    { kind: "player", playerId: CASEY.id, name: CASEY.name, side: "B", slot: 0, ratingBefore: 1035, delta: 15, ratingAfter: 1050 },
  ],
};

/** A Guest on the winning side: plain text, a GUEST marker, and no delta chip. */
const withGuest: FeedMatch = {
  id: "aaaaaaaa-0003-7000-8000-000000000000",
  playedAt: hoursAgo(54),
  loggedAt: hoursAgo(54),
  loggedBy: LONG.id,
  loggedByName: LONG.name,
  winnerSide: "B",
  sets: [
    { a: 2, b: 6 },
    { a: 4, b: 6 },
  ],
  participants: [
    { kind: "player", playerId: CASEY.id, name: CASEY.name, side: "A", slot: 0, ratingBefore: 1058, delta: -8, ratingAfter: 1050 },
    { kind: "player", playerId: RETIRED.id, name: RETIRED.name, side: "A", slot: 1, ratingBefore: 1120, delta: -8, ratingAfter: 1112 },
    { kind: "guest", name: "Mira (visiting)", side: "B", slot: 0 },
    { kind: "player", playerId: LONG.id, name: LONG.name, side: "B", slot: 1, ratingBefore: 1194, delta: 16, ratingAfter: 1210 },
  ],
};

/** One Guest per side — the domain maximum, with half a delta row per side. */
const guestPair: FeedMatch = {
  id: "aaaaaaaa-0004-7000-8000-000000000000",
  playedAt: hoursAgo(96),
  loggedAt: hoursAgo(96),
  loggedBy: YOU.id,
  loggedByName: YOU.name,
  winnerSide: "A",
  sets: [{ a: 6, b: 0 }],
  participants: [
    { kind: "player", playerId: YOU.id, name: YOU.name, side: "A", slot: 0, ratingBefore: 1310, delta: 5, ratingAfter: 1315 },
    { kind: "guest", name: "Guest with an implausibly long walk-on name", side: "A", slot: 1 },
    { kind: "player", playerId: ALSO_LONG.id, name: ALSO_LONG.name, side: "B", slot: 0, ratingBefore: 1395, delta: -5, ratingAfter: 1390 },
    { kind: "guest", name: "Jo", side: "B", slot: 1 },
  ],
};

export const FEED: FeedMatch[] = [
  doublesFiveSets,
  singlesSimple,
  withGuest,
  guestPair,
];

/**
 * The same feed as if the viewer had logged nothing recently. `canModifyMatch`
 * reads `loggedBy` and `loggedAt` against `now`, so moving the grace window is
 * how a case chooses whether the edit and delete affordances appear:
 * `doublesFiveSets` is two hours old and `singlesSimple` thirty, both logged by
 * different players.
 */
export const FEED_NONE_EDITABLE: FeedMatch[] = FEED.map((match) => ({
  ...match,
  loggedBy: RETIRED.id,
  loggedByName: RETIRED.name,
}));

const queuedBase = {
  ownerPlayerId: YOU.id,
  ownerPlayerName: YOU.name,
  names: { A: [YOU.name, LONG.name], B: [ALSO_LONG.name, CASEY.name] },
  sides: {
    A: [
      { kind: "player" as const, playerId: YOU.id },
      { kind: "player" as const, playerId: LONG.id },
    ],
    B: [
      { kind: "player" as const, playerId: ALSO_LONG.id },
      { kind: "player" as const, playerId: CASEY.id },
    ],
  },
  winnerSide: "A" as const,
  queuedAt: hoursAgo(1).toISOString(),
};

/** Waiting quietly: no error yet, gold dashed frame, "rating pending" line. */
export const QUEUED_PENDING: QueuedMatch = {
  ...queuedBase,
  id: "bbbbbbbb-0001-7000-8000-000000000000",
  playedAt: hoursAgo(1).toISOString(),
  sets: [
    { a: 6, b: 3 },
    { a: 6, b: 4 },
  ],
};

/**
 * One queued card per refusal code — the mechanical completeness check of
 * decision 128. `MatchSyncRefusal` is a closed union, so this `Record` fails
 * `tsc` the moment a code is added without a card to show what it looks like.
 * Never widen it to `Partial<>`: the split between permanent refusals (framed
 * red, offered Discard) and transient ones (gold, status line only) is exactly
 * the thing a new code could get wrong.
 */
export const QUEUED_BY_REFUSAL: Record<MatchSyncRefusal, QueuedMatch> = {
  "not-bound": {
    ...queuedBase,
    id: "cccccccc-0001-7000-8000-000000000000",
    playedAt: hoursAgo(4).toISOString(),
    sets: null,
    syncCode: "not-bound",
    syncError: "This device isn't joined to the circle right now.",
  },
  "identity-mismatch": {
    ...queuedBase,
    id: "cccccccc-0002-7000-8000-000000000000",
    playedAt: hoursAgo(5).toISOString(),
    sets: null,
    syncCode: "identity-mismatch",
    syncError:
      "This match was logged by Bartholomew Fitzgerald-Huang, but this device is now joined as Simon.",
  },
  "not-allowed": {
    ...queuedBase,
    id: "cccccccc-0003-7000-8000-000000000000",
    playedAt: hoursAgo(6).toISOString(),
    sets: null,
    syncCode: "not-allowed",
    syncError: "You're not allowed to log a match for those players.",
  },
  "rate-limited": {
    ...queuedBase,
    id: "cccccccc-0004-7000-8000-000000000000",
    playedAt: hoursAgo(7).toISOString(),
    sets: null,
    syncCode: "rate-limited",
    syncError: "Too many match writes just now.",
  },
  invalid: {
    ...queuedBase,
    id: "cccccccc-0005-7000-8000-000000000000",
    playedAt: hoursAgo(8).toISOString(),
    sets: null,
    syncCode: "invalid",
    syncError: "A match needs exactly one winning side.",
  },
};

/**
 * A refusal that fixes itself. Derived from the exhaustive refusal fixture so
 * the representative Feed case cannot drift from the union catalogue.
 */
export const QUEUED_TRANSIENT: QueuedMatch = {
  ...QUEUED_BY_REFUSAL["rate-limited"],
  id: "bbbbbbbb-0002-7000-8000-000000000000",
  playedAt: hoursAgo(3).toISOString(),
};

/**
 * A dead end. Derived from the exhaustive identity-mismatch fixture, then made
 * deliberately tall for the Feed layout case.
 */
export const QUEUED_BLOCKED: QueuedMatch = {
  ...QUEUED_BY_REFUSAL["identity-mismatch"],
  id: "bbbbbbbb-0003-7000-8000-000000000000",
  playedAt: hoursAgo(26).toISOString(),
  names: { A: [LONG.name, ALSO_LONG.name], B: [CASEY.name, RETIRED.name] },
  ownerPlayerName: LONG.name,
  sets: [
    { a: 7, b: 6 },
    { a: 6, b: 7 },
    { a: 6, b: 2 },
  ],
};

export const QUEUED_INCOMPATIBLE: IncompatibleQueuedMatch = {
  incompatible: true,
  id: "dddddddd-0001-7000-8000-000000000000",
  queuedAt: hoursAgo(30).toISOString(),
  ownerPlayerName: "Simon",
  syncCode: "invalid",
  syncError:
    "This queued match was saved by an incompatible app version and cannot be synced. Review it, then discard it explicitly.",
};
