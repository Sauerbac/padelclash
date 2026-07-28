import { asc, eq, sql } from "drizzle-orm";
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
  type EngineMatch,
  type MatchSide,
} from "../domain/rating/engine";
import { canModifyMatch, type MatchActor } from "../domain/edit-rights";
import {
  validateMatchIntake,
  type ValidatedMatchParticipant,
} from "../domain/match-intake";
import type { MatchParticipant } from "../domain/match-participant";
import {
  createMatchLogProjection,
  type MatchLogSnapshot,
} from "../domain/match-log-projection";
export type {
  CompanionRecord,
  FeedMatch,
  FeedParticipant,
  LeaderboardEntry,
  PlayerDetail,
  RatingPoint,
} from "../domain/match-log-projection";

export class MatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MatchValidationError";
  }
}

export interface LogMatchInput {
  /** Client-generated UUIDv7 — the offline-sync idempotency key. */
  id: string;
  playedAt: Date;
  /** The Logger: the player bound to the logging device. */
  loggedBy: string;
  /** Discriminated Player/Guest participants per Side. */
  sides: Record<MatchSide, MatchParticipant[]>;
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
  return db.transaction(async (tx) => {
    // Writers must run one at a time: under READ COMMITTED, two concurrent
    // logs would each replay a log missing the other's match, and the second
    // commit would overwrite the projections with that stale replay. The
    // advisory lock is transaction-scoped (released on commit/rollback) and
    // doesn't block readers.
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);
    const normalizedSides = await validateIntake(tx, input);

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

    await tx
      .insert(matchParticipants)
      .values(participantInsertRows(match.id, normalizedSides));

    await replayProjections(tx);

    return {
      match,
      deltas: await deltasOf(tx, match.id),
      alreadyLogged: false,
    };
  });
}

export interface EditMatchInput {
  /** Id of the match being corrected. */
  id: string;
  playedAt: Date;
  sides: Record<MatchSide, MatchParticipant[]>;
  winnerSide: MatchSide;
  sets?: SetScore[] | null;
}

export interface EditedMatch {
  match: Match;
  /** The corrected match's rating_history rows, post-replay. */
  deltas: RatingHistoryRow[];
}

/**
 * Correct a logged match: every played-fact is replaceable (playedAt, sides,
 * winner, sets); id, loggedBy and loggedAt are history and never change.
 * Edit rights are enforced here, inside the transaction, and projections are
 * replayed in the same transaction, exactly like logMatch.
 */
export async function editMatch(
  db: Db,
  input: EditMatchInput,
  actor: MatchActor,
  now: Date = new Date(),
): Promise<EditedMatch> {
  return db.transaction(async (tx) => {
    // Same writer serialization as logMatch (see there).
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);

    await requireModifiableMatch(tx, input.id, actor, now, "edit");
    const normalizedSides = await validateIntake(tx, input);

    const [match] = await tx
      .update(matches)
      .set({
        playedAt: input.playedAt,
        winnerSide: input.winnerSide,
        sets: input.sets ?? null,
      })
      .where(eq(matches.id, input.id))
      .returning();

    // Participants are replaced wholesale — simpler than diffing sides.
    await tx
      .delete(matchParticipants)
      .where(eq(matchParticipants.matchId, input.id));
    await tx
      .insert(matchParticipants)
      .values(participantInsertRows(input.id, normalizedSides));

    await replayProjections(tx);

    return { match, deltas: await deltasOf(tx, input.id) };
  });
}

/**
 * Delete a match from the log (spec "Match": a deleted match is a deleted
 * row — FK cascade removes participants and history) and replay projections
 * in the same transaction, exactly like logMatch. Edit rights are enforced
 * here, inside the transaction, not just in the UI.
 */
export async function deleteMatch(
  db: Db,
  matchId: string,
  actor: MatchActor,
  now: Date = new Date(),
): Promise<void> {
  return db.transaction(async (tx) => {
    // Same writer serialization as logMatch: a writer that skips the lock
    // could commit a replay that misses a concurrent write.
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);

    await requireModifiableMatch(tx, matchId, actor, now, "delete");

    await tx.delete(matches).where(eq(matches.id, matchId));
    await replayProjections(tx);
  });
}

// The shared edit/delete preamble: the match must exist and the actor must
// hold edit rights (spec "Edit rights"). Call after taking the write lock.
async function requireModifiableMatch(
  tx: Db,
  matchId: string,
  actor: MatchActor,
  now: Date,
  action: "edit" | "delete",
): Promise<void> {
  const [match] = await tx
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!match) throw new Error("Match not found");
  if (!canModifyMatch(match, actor, now)) {
    throw new Error(
      `Only the Logger (within 24 h) or the admin can ${action} a match`,
    );
  }
}

function deltasOf(tx: Db, matchId: string): Promise<RatingHistoryRow[]> {
  return tx
    .select()
    .from(ratingHistory)
    .where(eq(ratingHistory.matchId, matchId));
}

async function validateIntake(
  tx: Db,
  input: Pick<LogMatchInput, "sides" | "winnerSide" | "sets">,
): Promise<Record<MatchSide, ValidatedMatchParticipant[]>> {
  const roster = await tx
    .select({
      id: players.id,
      name: players.name,
    })
    .from(players);
  const validation = validateMatchIntake(
    {
      sides: input.sides,
      winnerSide: input.winnerSide,
      sets: input.sets ?? null,
    },
    {
      // Includes Retired Players: a Match queued while active may sync later.
      playerIds: roster.map(({ id }) => id),
      reservedPlayerNames: roster.map(({ name }) => name),
    },
  );
  if (!validation.ok) {
    throw new MatchValidationError(validation.error.message);
  }
  return validation.sides;
}

function participantValues(participant: ValidatedMatchParticipant): {
  playerId: string | null;
  guestName: string | null;
  guestNormalizedName: string | null;
} {
  return participant.kind === "player"
    ? {
        playerId: participant.playerId,
        guestName: null,
        guestNormalizedName: null,
      }
    : {
        playerId: null,
        guestName: participant.name,
        guestNormalizedName: participant.normalizedName,
      };
}

function participantInsertRows(
  matchId: string,
  sides: Record<MatchSide, ValidatedMatchParticipant[]>,
) {
  return (["A", "B"] as const).flatMap((side) =>
    sides[side].map((participant, slot) => ({
      matchId,
      side,
      slot,
      ...participantValues(participant),
    })),
  );
}

export interface MatchWithSides {
  match: Match;
  /** Complete participant list; Guests are plain match-scoped names. */
  participants: MatchParticipantRead[];
}

export type MatchParticipantRead =
  | {
      kind: "player";
      playerId: string;
      name: string;
      side: MatchSide;
      slot: number;
    }
  | {
      kind: "guest";
      name: string;
      side: MatchSide;
      slot: number;
    };

function toParticipantRead(row: {
  playerId: string | null;
  playerName: string | null;
  guestName: string | null;
  side: MatchSide;
  slot: number;
}): MatchParticipantRead {
  return row.playerId === null
    ? {
        kind: "guest",
        name: row.guestName ?? "Unknown Guest",
        side: row.side,
        slot: row.slot,
      }
    : {
        kind: "player",
        playerId: row.playerId,
        name: row.playerName ?? "Unknown",
        side: row.side,
        slot: row.slot,
      };
}

// Ids arriving from URLs are junk until proven uuid — pg throws on the cast.
function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** A single match by id — the edit screen's read. Null when it doesn't exist. */
export async function getMatch(
  db: Db,
  matchId: string,
): Promise<MatchWithSides | null> {
  if (!isUuid(matchId)) return null;

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));
  if (!match) return null;

  const participants = await db
    .select({
      playerId: matchParticipants.playerId,
      playerName: players.name,
      guestName: matchParticipants.guestName,
      side: matchParticipants.side,
      slot: matchParticipants.slot,
    })
    .from(matchParticipants)
    .leftJoin(players, eq(matchParticipants.playerId, players.id))
    .where(eq(matchParticipants.matchId, matchId))
    .orderBy(asc(matchParticipants.side), asc(matchParticipants.slot));

  return { match, participants: participants.map(toParticipantRead) };
}

export async function getFeed(db: Db) {
  return createMatchLogProjection(await readMatchLogSnapshot(db)).feed();
}

export async function getLeaderboard(db: Db) {
  return createMatchLogProjection(await readMatchLogSnapshot(db)).leaderboard();
}

export async function getPlayerDetail(db: Db, playerId: string) {
  if (!isUuid(playerId)) return null;
  return createMatchLogProjection(
    await readMatchLogSnapshot(db),
  ).playerDetail(playerId);
}

/**
 * Load every Match-log read source from one PostgreSQL snapshot. The optional
 * observer is a concurrency-test seam called after the roster read has
 * established the snapshot and before the remaining reads.
 */
export async function readMatchLogSnapshot(
  db: Db,
  observer?: (stage: "roster" | "rating-history") => Promise<void>,
): Promise<MatchLogSnapshot> {
  return db.transaction(
    async (tx) => {
      const roster = await tx.select().from(players);
      await observer?.("roster");
      // One pg connection owns the transaction; run its statements
      // sequentially rather than queueing concurrent client.query calls.
      // History intentionally comes before Match rows: the integration test
      // commits a writer between them and proves REPEATABLE READ keeps both
      // reads on the same pre-write snapshot.
      const historyRows = await tx.select().from(ratingHistory);
      await observer?.("rating-history");
      const matchRows = await tx.select().from(matches);
      const participantRows = await tx.select().from(matchParticipants);
      const ratingRows = await tx.select().from(currentRating);
      return {
        players: roster,
        matches: matchRows,
        participants: participantRows,
        ratingHistory: historyRows,
        currentRatings: ratingRows,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/**
 * Replay the full match log through the pure engine and rewrite both
 * projection tables. Must run inside the transaction that changed the log.
 */
export async function rebuildRatingProjections(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${MATCH_LOG_LOCK_KEY})`);
    await replayProjections(tx);
  });
}

async function replayProjections(tx: Db): Promise<void> {
  const [matchRows, participantRows] = await Promise.all([
    tx.select().from(matches),
    tx.select().from(matchParticipants),
  ]);

  const sidesByMatch = new Map<
    string,
    Record<MatchSide, MatchParticipant[]>
  >();
  for (const p of participantRows) {
    const sides = sidesByMatch.get(p.matchId) ?? { A: [], B: [] };
    sides[p.side].push(
      p.playerId === null
        ? { kind: "guest", name: p.guestName ?? "Unknown Guest" }
        : { kind: "player", playerId: p.playerId },
    );
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
    sets: m.sets,
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
