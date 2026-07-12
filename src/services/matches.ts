import { asc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "./db";
import {
  currentRating,
  matches,
  matchParticipants,
  players,
  ratingHistory,
  type Match,
  type RatingHistoryRow,
  type SetScore,
} from "./db/schema";
import {
  projectGroup,
  rankMap,
  STARTING_RATING,
  type CurrentRating,
  type EngineMatch,
  type MatchSide,
  type PlayerId,
} from "../domain/rating/engine";

export interface LogMatchInput {
  /** Client-generated UUIDv7 — the offline-sync idempotency key. */
  id: string;
  playedAt: Date;
  /** The Logger: the player bound to the logging device. */
  loggedBy: string;
  /** Player ids per Side — the engine's own shape, used end-to-end. */
  sides: Record<MatchSide, string[]>;
  winnerSide: MatchSide;
  /** Set Score detail; omit for a Simple Result. */
  sets?: SetScore[] | null;
}

export interface LoggedMatch {
  match: Match;
  /** This match's rating_history rows — the post-submit payoff. */
  deltas: RatingHistoryRow[];
  /** True when the id already existed (an offline-sync retry): nothing was re-logged. */
  alreadyLogged: boolean;
}

// Serializes writers to the match log (see logMatch). Arbitrary app-unique key.
const MATCH_LOG_LOCK_KEY = 7_454_001;

/**
 * Append a match to the log and synchronously rebuild both projections
 * (spec "Rating engine"): the whole log is replayed and rating_history +
 * current_rating are rewritten in the SAME transaction as the insert, so
 * readers never see a match without its ratings.
 */
export async function logMatch(
  db: Db,
  input: LogMatchInput,
): Promise<LoggedMatch> {
  validateSides(input.sides);
  validateSets(input.sets ?? null);
  return db.transaction(async (tx) => {
    // Writers must run one at a time: under READ COMMITTED, two concurrent
    // logs would each replay a log missing the other's match, and the second
    // commit would overwrite the projections with that stale replay. The
    // advisory lock is transaction-scoped (released on commit/rollback) and
    // doesn't block readers.
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);

    const [match] = await tx
      .insert(matches)
      .values({
        id: input.id,
        playedAt: input.playedAt,
        loggedBy: input.loggedBy,
        winnerSide: input.winnerSide,
        sets: input.sets ?? null,
      })
      .onConflictDoNothing()
      .returning();

    // Conflict on the client-generated id = an offline-sync retry. Return the
    // stored result untouched — replaying an insert must not double-log.
    if (!match) {
      const [existing] = await tx
        .select()
        .from(matches)
        .where(eq(matches.id, input.id));
      return {
        match: existing,
        deltas: await deltasOf(tx, input.id),
        alreadyLogged: true,
      };
    }

    await tx.insert(matchParticipants).values(
      (["A", "B"] as const).flatMap((side) =>
        input.sides[side].map((playerId) => ({
          matchId: match.id,
          playerId,
          side,
        })),
      ),
    );

    await replayProjections(tx);

    return {
      match,
      deltas: await deltasOf(tx, match.id),
      alreadyLogged: false,
    };
  });
}

function deltasOf(tx: Db, matchId: string): Promise<RatingHistoryRow[]> {
  return tx
    .select()
    .from(ratingHistory)
    .where(eq(ratingHistory.matchId, matchId));
}

// Sides are 1v1 or 2v2, and a player appears on exactly one side, once
// (spec "Match"). Checked before the transaction opens.
function validateSides(sides: Record<MatchSide, string[]>): void {
  if (sides.A.length !== sides.B.length) {
    throw new Error("Sides must have the same number of players");
  }
  if (sides.A.length < 1 || sides.A.length > 2) {
    throw new Error("Sides must have 1 (singles) or 2 (doubles) players");
  }
  const all = [...sides.A, ...sides.B];
  if (new Set(all).size !== all.length) {
    throw new Error("A player can appear on only one side, once");
  }
}

// A Set Score is games per set, e.g. 6-4 (spec "Match"). Bounds are sanity
// caps, not tennis rules — unusual scorelines are the players' business.
function validateSets(sets: SetScore[] | null): void {
  if (sets === null) return;
  const valid =
    sets.length >= 1 &&
    sets.length <= 5 &&
    sets.every(
      (s) =>
        Number.isInteger(s.a) &&
        Number.isInteger(s.b) &&
        s.a >= 0 &&
        s.b >= 0 &&
        s.a <= 99 &&
        s.b <= 99,
    );
  if (!valid) {
    throw new Error("Set scores must be 1-5 sets of games from 0 to 99");
  }
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  rating: number;
  /** 1-based leaderboard rank; null while below the ranked threshold. */
  rank: number | null;
  wins: number;
  losses: number;
  matchesPlayed: number;
}

/**
 * The Leaderboard read (spec "Screens"): every active player — ranked players
 * first in rank order (rankMap is the single definition of ordering), then the
 * unranked below, highest rating first. Players yet to play appear unranked at
 * the starting rating with a 0–0 record.
 */
export async function getLeaderboard(db: Db): Promise<LeaderboardEntry[]> {
  const [roster, ratingRows, results] = await Promise.all([
    db
      .select()
      .from(players)
      .where(isNull(players.retiredAt))
      .orderBy(asc(players.createdAt)),
    db.select().from(currentRating),
    // W–L comes straight from the log, not the projections.
    db
      .select({
        playerId: matchParticipants.playerId,
        side: matchParticipants.side,
        winnerSide: matches.winnerSide,
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matchParticipants.matchId, matches.id)),
  ]);

  const current = new Map<PlayerId, CurrentRating>(
    ratingRows.map((r) => [r.playerId, r]),
  );
  const ranks = rankMap(current);

  const record = new Map<string, { wins: number; losses: number }>();
  for (const r of results) {
    const tally = record.get(r.playerId) ?? { wins: 0, losses: 0 };
    if (r.side === r.winnerSide) tally.wins++;
    else tally.losses++;
    record.set(r.playerId, tally);
  }

  const entries = roster.map((player) => {
    const rating = current.get(player.id);
    const tally = record.get(player.id);
    return {
      playerId: player.id,
      name: player.name,
      rating: rating?.rating ?? STARTING_RATING,
      rank: ranks.get(player.id) ?? null,
      wins: tally?.wins ?? 0,
      losses: tally?.losses ?? 0,
      matchesPlayed: rating?.competitiveMatchesPlayed ?? 0,
    };
  });

  return entries.sort(
    (a, b) =>
      (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
      b.rating - a.rating ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Replay the full match log through the pure engine and rewrite both
 * projection tables. Must run inside the transaction that changed the log.
 */
async function replayProjections(tx: Db): Promise<void> {
  const [matchRows, participantRows] = await Promise.all([
    tx.select().from(matches),
    tx.select().from(matchParticipants),
  ]);

  const sidesByMatch = new Map<string, Record<MatchSide, string[]>>();
  for (const p of participantRows) {
    const sides = sidesByMatch.get(p.matchId) ?? { A: [], B: [] };
    sides[p.side].push(p.playerId);
    sidesByMatch.set(p.matchId, sides);
  }

  const engineMatches: EngineMatch[] = matchRows.map((m) => ({
    id: m.id,
    playedAt: m.playedAt,
    loggedAt: m.loggedAt,
    // Lite v1 only ever produces competitive/confirmed (spec "Rating engine").
    classification: "competitive",
    status: "confirmed",
    sides: sidesByMatch.get(m.id) ?? { A: [], B: [] },
    winnerSide: m.winnerSide,
  }));

  const projection = projectGroup(engineMatches);

  await tx.delete(ratingHistory);
  await tx.delete(currentRating);
  if (projection.ratingHistory.length > 0) {
    await tx.insert(ratingHistory).values(projection.ratingHistory);
  }
  const currentRows = [...projection.currentRating.values()];
  if (currentRows.length > 0) {
    await tx.insert(currentRating).values(currentRows);
  }
}
