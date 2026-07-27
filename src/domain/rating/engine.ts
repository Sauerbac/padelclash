// Framework-free Rating replay. Persistence belongs in services/.

import type {
  GuestParticipant,
  MatchParticipant as EngineParticipant,
  PlayerParticipant,
} from "../match-participant";

export type { EngineParticipant, GuestParticipant, PlayerParticipant };

export type PlayerId = string;
export type MatchSide = "A" | "B";

export const STARTING_RATING = 1000;
export const ESTABLISHED_K = 50;
export const RATING_DIVISOR = 400;
/**
 * One number for three things (spec decision 123): how long the K taper runs,
 * when a Player stops being Provisional, and when they may hold a Rank. They
 * were separate constants once and had already drifted apart.
 */
export const RATED_THRESHOLD = 3;
/** First-Match K; the taper steps down to ESTABLISHED_K over RATED_THRESHOLD matches. */
export const PLACEMENT_START_K = 80;
export const PLACEMENT_STEP_K = 10;
/** A result never rounds away to nothing (decision 108). There is no ceiling (decision 119). */
export const MIN_CHANGE = 1;

export interface EngineSetScore {
  a: number;
  b: number;
}

export interface EngineMatch {
  id: string;
  playedAt: Date;
  loggedAt: Date;
  classification: "competitive" | "casual";
  status: "pending" | "confirmed" | "contested" | "voided";
  sides: Record<MatchSide, readonly EngineParticipant[]>;
  winnerSide: MatchSide;
  sets: readonly EngineSetScore[] | null;
}

export interface PlayerState {
  rating: number;
  competitiveMatchesPlayed: number;
  matchesSinceReset: number;
}

export interface ParticipantOutput {
  matchId: string;
  playerId: PlayerId;
  side: MatchSide;
  ratingBefore: number;
  delta: number;
  ratingAfter: number;
  wasProvisional: boolean;
  expectedScore: number;
  playedAt: Date;
}

export interface CurrentRating {
  playerId: PlayerId;
  rating: number;
  competitiveMatchesPlayed: number;
  matchesSinceReset: number;
  isProvisional: boolean;
  isRanked: boolean;
  lastMatchAt: Date | null;
}

export interface GroupProjection {
  currentRating: Map<PlayerId, CurrentRating>;
  ratingHistory: ParticipantOutput[];
}

export function expectedScore(ratingFor: number, ratingAgainst: number): number {
  return 1 / (1 + 10 ** ((ratingAgainst - ratingFor) / RATING_DIVISOR));
}

/**
 * The placement taper (decision 120): 80, 70, 60, then 50 forever. Written as a
 * floored line rather than a lookup so it reaches ESTABLISHED_K exactly at
 * RATED_THRESHOLD — the taper and the steady state cannot disagree, and there
 * is no perceptible cliff at the boundary the way a flat Provisional K had.
 */
export function kFactor(state: PlayerState): number {
  return Math.max(
    ESTABLISHED_K,
    PLACEMENT_START_K - PLACEMENT_STEP_K * state.competitiveMatchesPlayed,
  );
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
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Set Score dominance (decision 121), bonus-only and never below 1.
 *
 * Games alone are not dominance: a games-only ratio scored `6-4, 6-4` below
 * `6-0, 0-6, 6-1`, rewarding the Player who was bagelled in a set over the one
 * who never dropped one. Weighting by set margin restores that — straight-sets
 * results keep their full games ratio, and dropping a set cuts the bonus.
 *
 * A contradictory Score (winner ahead on games, behind on sets) yields a
 * negative margin, which clamps to zero and degrades the Match to plain
 * win/loss movement rather than being rejected.
 */
function scoreMultiplier(
  sets: readonly EngineSetScore[] | null,
  winnerSide: MatchSide,
): number {
  if (sets === null || sets.length === 0) return 1;
  let winnerGames = 0;
  let loserGames = 0;
  let winnerSets = 0;
  let loserSets = 0;
  for (const set of sets) {
    const won = winnerSide === "A" ? set.a : set.b;
    const lost = winnerSide === "A" ? set.b : set.a;
    winnerGames += won;
    loserGames += lost;
    if (won > lost) winnerSets++;
    else if (lost > won) loserSets++;
  }
  const totalGames = winnerGames + loserGames;
  const gamesRatio =
    totalGames === 0 ? 0 : Math.max(0, winnerGames - loserGames) / totalGames;
  const setMargin = (winnerSets - loserSets) / sets.length;
  const dominance = Math.min(1, Math.max(0, gamesRatio * setMargin));
  return 1 + 0.4 * dominance;
}

/**
 * Pure step from one immutable pre-Match snapshot to the next. Guests receive
 * an input Rating but never an output or threaded state.
 */
export function replayMatch(
  prior: ReadonlyMap<PlayerId, PlayerState>,
  match: EngineMatch,
): { next: Map<PlayerId, PlayerState>; outputs: ParticipantOutput[] } {
  const players = [...match.sides.A, ...match.sides.B].filter(
    (participant): participant is PlayerParticipant =>
      participant.kind === "player",
  );
  const guestRating = mean(
    players.map((participant) => stateOf(prior, participant.playerId).rating),
  );
  const participantRating = (participant: EngineParticipant): number =>
    participant.kind === "player"
      ? stateOf(prior, participant.playerId).rating
      : guestRating;
  const opposingMean: Record<MatchSide, number> = {
    A: mean(match.sides.B.map(participantRating)),
    B: mean(match.sides.A.map(participantRating)),
  };
  const multiplier = scoreMultiplier(match.sets, match.winnerSide);
  const next = new Map(prior);
  const outputs: ParticipantOutput[] = [];

  for (const side of ["A", "B"] as const) {
    for (const participant of match.sides[side]) {
      if (participant.kind === "guest") continue;
      const before = stateOf(prior, participant.playerId);
      const expected = expectedScore(before.rating, opposingMean[side]);
      const won = match.winnerSide === side;
      const base = kFactor(before) * (won ? 1 - expected : expected);
      // Floor only — an upper bound would clip exactly the upsets and shutouts
      // this engine exists to reward (decision 119). K is the bound.
      const magnitude = Math.max(MIN_CHANGE, Math.round(base * multiplier));
      const delta = won ? magnitude : -magnitude;
      const ratingAfter = before.rating + delta;

      next.set(participant.playerId, {
        rating: ratingAfter,
        competitiveMatchesPlayed: before.competitiveMatchesPlayed + 1,
        matchesSinceReset: before.matchesSinceReset + 1,
      });
      outputs.push({
        matchId: match.id,
        playerId: participant.playerId,
        side,
        ratingBefore: before.rating,
        delta,
        ratingAfter,
        wasProvisional: before.competitiveMatchesPlayed < RATED_THRESHOLD,
        expectedScore: expected,
        playedAt: match.playedAt,
      });
    }
  }

  return { next, outputs };
}

export function compareMatches(a: EngineMatch, b: EngineMatch): number {
  return (
    a.playedAt.getTime() - b.playedAt.getTime() ||
    a.loggedAt.getTime() - b.loggedAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function projectGroup(
  matches: readonly EngineMatch[],
): GroupProjection {
  const stream = matches
    .filter((match) => match.classification === "competitive" && match.status !== "voided")
    .sort(compareMatches);

  let state: ReadonlyMap<PlayerId, PlayerState> = new Map();
  const ratingHistory: ParticipantOutput[] = [];
  const lastMatchAt = new Map<PlayerId, Date>();

  for (const match of stream) {
    const { next, outputs } = replayMatch(state, match);
    state = next;
    for (const output of outputs) {
      ratingHistory.push(output);
      lastMatchAt.set(output.playerId, match.playedAt);
    }
  }

  const currentRating = new Map<PlayerId, CurrentRating>();
  for (const [playerId, player] of state) {
    currentRating.set(playerId, {
      playerId,
      rating: player.rating,
      competitiveMatchesPlayed: player.competitiveMatchesPlayed,
      matchesSinceReset: player.matchesSinceReset,
      isProvisional: player.competitiveMatchesPlayed < RATED_THRESHOLD,
      isRanked: player.competitiveMatchesPlayed >= RATED_THRESHOLD,
      lastMatchAt: lastMatchAt.get(playerId) ?? null,
    });
  }

  return { currentRating, ratingHistory };
}

export function rankMap(
  current: ReadonlyMap<PlayerId, CurrentRating>,
): Map<PlayerId, number> {
  const ranked = [...current.values()]
    .filter((entry) => entry.isRanked)
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0),
    );
  return new Map(ranked.map((entry, index) => [entry.playerId, index + 1]));
}
