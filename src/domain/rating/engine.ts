// The pure rating engine — ratings are derived by replaying the match log
// (docs/padelclash-lite-spec.md, "Rating engine"). Carried over verbatim from
// the pre-Lite codebase.
//
// This module is FRAMEWORK-FREE: no Next, no Drizzle, no src/db. It is testable
// in milliseconds with no infrastructure. The transaction that persists its
// output lives one layer up, in services/ — never here.
//
// A Side is modelled as an array of player ids, so doubles is the *same* engine
// with sides of one or two; the formula below generalises (mean Side rating,
// delta split equally). A Provisional high-K phase is on the spec's Later list;
// the extension point is `kFactor()`.

export type PlayerId = string;
export type MatchSide = "A" | "B";

/** The starting Rating of an unseen Player. */
export const STARTING_RATING = 1000;
/** Normal K-factor. A Provisional high-K phase is deferred (Later list). */
export const BASE_K = 32;
/** The logistic divisor in the expected-score formula. */
export const RATING_DIVISOR = 400;
/** Competitive matches a Player needs to hold a Rank. */
export const DEFAULT_RANKED_THRESHOLD = 3;

/**
 * One element of the replay stream. A minimal, pure view of a `match` row plus
 * its participants — enough for the engine, nothing more. Built in the domain
 * layer (id included, UUIDv7) without a DB round-trip.
 *
 * In Lite v1 the app only ever produces `classification: "competitive"` and
 * `status: "confirmed"`; the other values are kept so the engine ports untouched
 * and the casual-flag / confirmation Later items stay pure add-ons.
 */
export interface EngineMatch {
  id: string;
  playedAt: Date;
  loggedAt: Date;
  classification: "competitive" | "casual";
  status: "pending" | "confirmed" | "contested" | "voided";
  /** Player ids per Side. One id = singles; two = doubles. */
  sides: Record<MatchSide, readonly PlayerId[]>;
  winnerSide: MatchSide;
}

/**
 * The threaded state per Player in the replayed log — rating-only and minimal:
 * nothing here that does not feed a future Rating. `matchesSinceReset` mirrors
 * `competitiveMatchesPlayed` (no resets in Lite); both are carried so a future
 * Provisional phase is a pure add-on.
 */
export interface PlayerState {
  rating: number;
  competitiveMatchesPlayed: number;
  matchesSinceReset: number;
}

/** One per-match output row per participant. These rows ARE `rating_history`. */
export interface ParticipantOutput {
  matchId: string;
  playerId: PlayerId;
  side: MatchSide;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
  wasProvisional: boolean;
  /** The participant's Side's pre-match expected score (Win Probability). */
  winProbability: number;
  playedAt: Date;
}

/** One `current_rating` row — the end-state of the replay loop, written out. */
export interface CurrentRating {
  playerId: PlayerId;
  rating: number;
  competitiveMatchesPlayed: number;
  matchesSinceReset: number;
  isProvisional: boolean;
  isRanked: boolean;
  lastMatchAt: Date | null;
}

/** The full projection of one group's log: both projection tables, in memory. */
export interface GroupProjection {
  currentRating: Map<PlayerId, CurrentRating>;
  ratingHistory: ParticipantOutput[];
}

/**
 * Logistic expected score of a Side rated `ratingFor` against `ratingAgainst`.
 * E + E' == 1 (to floating-point precision) for the mirror call, which is what
 * makes per-match deltas sum to zero.
 */
export function expectedScore(ratingFor: number, ratingAgainst: number): number {
  return 1 / (1 + 10 ** ((ratingAgainst - ratingFor) / RATING_DIVISOR));
}

/**
 * The K-factor for a Rating update. Constant in Lite v1. A Provisional phase
 * (higher K for a Player's first matches) would plug in here using the counts
 * on `PlayerState` — that change re-adds the `state` parameter (Later list).
 */
export function kFactor(): number {
  return BASE_K;
}

function stateOf(
  byPlayer: ReadonlyMap<PlayerId, PlayerState>,
  id: PlayerId,
): PlayerState {
  return (
    byPlayer.get(id) ?? {
      rating: STARTING_RATING,
      competitiveMatchesPlayed: 0,
      matchesSinceReset: 0,
    }
  );
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * The engine function (ADR-0001): a pure step from prior state + one match to
 * the next state and one output row per participant. Does not mutate `prior`;
 * returns a fresh state map so the fold stays referentially honest.
 *
 * Caller guarantees `match` belongs in the stream (Competitive, non-Voided).
 */
export function replayMatch(
  prior: ReadonlyMap<PlayerId, PlayerState>,
  match: EngineMatch,
): { next: Map<PlayerId, PlayerState>; outputs: ParticipantOutput[] } {
  const sideRating: Record<MatchSide, number> = {
    A: mean(match.sides.A.map((id) => stateOf(prior, id).rating)),
    B: mean(match.sides.B.map((id) => stateOf(prior, id).rating)),
  };

  const expected: Record<MatchSide, number> = {
    A: expectedScore(sideRating.A, sideRating.B),
    B: expectedScore(sideRating.B, sideRating.A),
  };

  const next = new Map(prior);
  const outputs: ParticipantOutput[] = [];

  for (const side of ["A", "B"] as const) {
    const players = match.sides[side];
    const actual = match.winnerSide === side ? 1 : 0;
    // Side delta, then split equally across the Side's players.
    const players0 = players.map((id) => stateOf(prior, id));
    const k = kFactor();
    const sideDelta = k * (actual - expected[side]);
    const perPlayerDelta = sideDelta / players.length;

    players.forEach((id, i) => {
      const before = players0[i];
      const ratingAfter = before.rating + perPlayerDelta;
      next.set(id, {
        rating: ratingAfter,
        competitiveMatchesPlayed: before.competitiveMatchesPlayed + 1,
        matchesSinceReset: before.matchesSinceReset + 1,
      });
      outputs.push({
        matchId: match.id,
        playerId: id,
        side,
        ratingBefore: before.rating,
        delta: perPlayerDelta,
        ratingAfter,
        // Provisional deferred this slice: no Player is treated as provisional.
        wasProvisional: false,
        winProbability: expected[side],
        playedAt: match.playedAt,
      });
    });
  }

  return { next, outputs };
}

/** Total order on the replay stream: (played-at, logged-at, id). */
export function compareMatches(a: EngineMatch, b: EngineMatch): number {
  return (
    a.playedAt.getTime() - b.playedAt.getTime() ||
    a.loggedAt.getTime() - b.loggedAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Replay a whole group's match log into both projection tables. Pure and
 * order-independent: filters to the Competitive, non-Voided stream, sorts by the
 * stable total order, then folds `replayMatch`. Calling it twice on the same log
 * yields identical output (idempotent rebuild).
 */
export function projectGroup(
  matches: readonly EngineMatch[],
  opts: { rankedThreshold?: number } = {},
): GroupProjection {
  const rankedThreshold = opts.rankedThreshold ?? DEFAULT_RANKED_THRESHOLD;

  const stream = matches
    .filter((m) => m.classification === "competitive" && m.status !== "voided")
    .sort(compareMatches);

  let state: ReadonlyMap<PlayerId, PlayerState> = new Map();
  const ratingHistory: ParticipantOutput[] = [];
  const lastMatchAt = new Map<PlayerId, Date>();

  for (const match of stream) {
    const { next, outputs } = replayMatch(state, match);
    state = next;
    for (const o of outputs) {
      ratingHistory.push(o);
      lastMatchAt.set(o.playerId, match.playedAt);
    }
  }

  const currentRating = new Map<PlayerId, CurrentRating>();
  for (const [playerId, s] of state) {
    currentRating.set(playerId, {
      playerId,
      rating: s.rating,
      competitiveMatchesPlayed: s.competitiveMatchesPlayed,
      matchesSinceReset: s.matchesSinceReset,
      isProvisional: false,
      isRanked: s.competitiveMatchesPlayed >= rankedThreshold,
      lastMatchAt: lastMatchAt.get(playerId) ?? null,
    });
  }

  return { currentRating, ratingHistory };
}

/**
 * Rank each ranked Player in a projection (1-based, highest rating first) — the
 * Leaderboard's ordering, expressed once. Unranked Players are absent from the map.
 * Shared by the leaderboard read, the log payoff, and the match-detail rank deltas
 * so "rank" means exactly one thing everywhere.
 */
export function rankMap(
  current: ReadonlyMap<PlayerId, CurrentRating>,
): Map<PlayerId, number> {
  const ranked = [...current.values()]
    .filter((c) => c.isRanked)
    .sort((a, b) => b.rating - a.rating);
  const ranks = new Map<PlayerId, number>();
  ranked.forEach((c, i) => ranks.set(c.playerId, i + 1));
  return ranks;
}
