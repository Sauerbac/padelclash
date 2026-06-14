// The groups application concern (module-structure.md): the create-group mutation
// and the reads the group screen needs. services/ is the only layer that knows
// both the domain and the database, so the membership-scoped queries and the
// leaderboard read off the `current_rating` projection live here, behind a small
// view-model surface the app layer maps to ui props.
//
// `db` is injectable (default the pooled client) so the Tier-3 integration test
// can target `padelclash_test`, exactly as `logMatch` does.

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { newId } from "@/db/ids";
import {
  currentRating,
  group,
  match,
  matchParticipant,
  membership,
  player,
  ratingHistory,
  user,
} from "@/db/schema";
import type { MatchSide } from "@/domain/rating/engine";

export interface CreateGroupInput {
  name: string;
  /** The founder's Player id — becomes the group's first, admin member. */
  founderPlayerId: string;
}

export interface CreateGroupResult {
  groupId: string;
}

/**
 * Create a Group and seat its founder as the admin member, atomically.
 *
 * Two inserts in one transaction (ADR-0002: a Group is the rating boundary; a
 * Membership is the (group, player) join). `trust_mode`, `status=active` and
 * `joined_at` take their schema defaults.
 */
export async function createGroup(
  input: CreateGroupInput,
  db: Database = getDb(),
): Promise<CreateGroupResult> {
  const name = input.name.trim();
  if (!name) throw new Error("createGroup: name is required");

  const groupId = newId();
  await db.transaction(async (tx) => {
    await tx.insert(group).values({ id: groupId, name });
    await tx.insert(membership).values({
      groupId,
      playerId: input.founderPlayerId,
      role: "admin",
    });
  });

  return { groupId };
}

export interface AddUnclaimedPlayerInput {
  /** The group to add the new player to. */
  groupId: string;
  /** The new player's display name. */
  displayName: string;
  /** The member performing the add — must be an active member of the group. */
  addedByPlayerId: string;
}

export interface AddUnclaimedPlayerResult {
  playerId: string;
}

/**
 * Thrown when an add would create a second active member sharing a display name.
 * A distinct type so the Server Action can turn it into a friendly inline error
 * rather than a 500 — every other throw here is a real fault.
 */
export class DuplicateMemberNameError extends Error {
  constructor(readonly displayName: string) {
    super(`addUnclaimedPlayer: "${displayName}" is already a member of this group`);
    this.name = "DuplicateMemberNameError";
  }
}

/**
 * Add an Unclaimed Player to a group and seat them as a member, atomically.
 *
 * An Unclaimed Player is just a `player` row no auth `user` references yet
 * (ADR-0004) — this never touches the auth tables; claiming is a later slice.
 * One transaction: authorize the adder, reject a duplicate name, then insert the
 * `player` + its `membership`. This is the founder-bootstrap path — one member can
 * populate a whole roster before anyone else signs up.
 *
 * Throws `DuplicateMemberNameError` on a name clash; a plain `Error` if the adder
 * is not an active member of the group.
 */
export async function addUnclaimedPlayer(
  input: AddUnclaimedPlayerInput,
  db: Database = getDb(),
): Promise<AddUnclaimedPlayerResult> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("addUnclaimedPlayer: displayName is required");

  return db.transaction(async (tx) => {
    // Authorization: only an active member may add players. Admin-vs-member is
    // deferred — see docs/open-questions/07-who-can-add-players.md.
    const [adder] = await tx
      .select({ playerId: membership.playerId })
      .from(membership)
      .where(
        and(
          eq(membership.groupId, input.groupId),
          eq(membership.playerId, input.addedByPlayerId),
          eq(membership.status, "active"),
        ),
      )
      .limit(1);
    if (!adder) {
      throw new Error("addUnclaimedPlayer: adder is not an active member");
    }

    // Reject a duplicate name among the group's active members (case-insensitive,
    // already trimmed). The check lives inside the tx so two concurrent adds can't
    // both pass it. Former members are excluded — the roster scope is active.
    const [clash] = await tx
      .select({ playerId: player.id })
      .from(membership)
      .innerJoin(player, eq(player.id, membership.playerId))
      .where(
        and(
          eq(membership.groupId, input.groupId),
          eq(membership.status, "active"),
          sql`lower(${player.displayName}) = ${displayName.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (clash) throw new DuplicateMemberNameError(displayName);

    const playerId = newId();
    await tx.insert(player).values({ id: playerId, displayName });
    await tx.insert(membership).values({
      groupId: input.groupId,
      playerId,
      role: "member",
    });

    return { playerId };
  });
}

/** A Group as seen by one of its members, with that member's role. */
export interface MemberGroup {
  id: string;
  name: string;
  role: "admin" | "member";
  rankedThreshold: number;
}

/**
 * The group, if `playerId` is an active member of it — otherwise null. This is
 * the authorization gate for the group screen: a non-member (or a missing group)
 * is indistinguishable, both null, so the route can 404 either way.
 */
export async function getGroupForMember(
  args: { groupId: string; playerId: string },
  db: Database = getDb(),
): Promise<MemberGroup | null> {
  const [row] = await db
    .select({
      id: group.id,
      name: group.name,
      role: membership.role,
      rankedThreshold: group.rankedThreshold,
    })
    .from(group)
    .innerJoin(membership, eq(membership.groupId, group.id))
    .where(
      and(
        eq(group.id, args.groupId),
        eq(membership.playerId, args.playerId),
        eq(membership.status, "active"),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** The active groups a Player belongs to, oldest first (the home landing pick). */
export async function listMemberGroups(
  playerId: string,
  db: Database = getDb(),
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: group.id, name: group.name })
    .from(group)
    .innerJoin(membership, eq(membership.groupId, group.id))
    .where(and(eq(membership.playerId, playerId), eq(membership.status, "active")))
    .orderBy(group.createdAt);
}

/** One ranked-table entry, read straight off the `current_rating` projection. */
export interface LeaderboardEntry {
  playerId: string;
  name: string;
  /** Full-precision rating from the projection; the route rounds for display. */
  rating: number;
  isRanked: boolean;
  isProvisional: boolean;
  competitiveMatchesPlayed: number;
}

/**
 * The group's leaderboard, ordered by rating (highest first). Reads the
 * `current_rating` projection — the materialized end-state of the replay loop
 * (ADR-0007) — joined to `player` for display names. A brand-new group has no
 * rated players yet, so this is empty until the first competitive match is logged.
 */
export async function getLeaderboard(
  groupId: string,
  db: Database = getDb(),
): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      playerId: currentRating.playerId,
      name: player.displayName,
      rating: currentRating.rating,
      isRanked: currentRating.isRanked,
      isProvisional: currentRating.isProvisional,
      competitiveMatchesPlayed: currentRating.competitiveMatchesPlayed,
    })
    .from(currentRating)
    .innerJoin(player, eq(player.id, currentRating.playerId))
    .where(eq(currentRating.groupId, groupId))
    .orderBy(desc(currentRating.rating));

  // `rating` is a Postgres `numeric` → driver returns a string; Number() restores
  // the engine's value (full precision round-trips, rating-engine.md).
  return rows.map((r) => ({ ...r, rating: Number(r.rating) }));
}

/** One roster entry — an active member of the group, claimed or not. */
export interface RosterMember {
  playerId: string;
  name: string;
  role: "admin" | "member";
  /** No auth `user` row references this player yet (ADR-0004). */
  isUnclaimed: boolean;
}

/**
 * The group's active members, in join order (founder first). Distinct from the
 * leaderboard: that reads `current_rating` and so shows only players with a rated
 * match, whereas the roster lists *everyone who belongs* — a freshly added
 * Unclaimed Player appears here immediately, before they have played. `isUnclaimed`
 * is the absence of an auth `user` pointing at the player (ADR-0004), surfaced as
 * the left join's null.
 */
export async function getRoster(
  groupId: string,
  db: Database = getDb(),
): Promise<RosterMember[]> {
  const rows = await db
    .select({
      playerId: player.id,
      name: player.displayName,
      role: membership.role,
      claimedUserId: user.id,
    })
    .from(membership)
    .innerJoin(player, eq(player.id, membership.playerId))
    .leftJoin(user, eq(user.playerId, player.id))
    .where(and(eq(membership.groupId, groupId), eq(membership.status, "active")))
    .orderBy(membership.joinedAt);

  return rows.map((r) => ({
    playerId: r.playerId,
    name: r.name,
    role: r.role,
    isUnclaimed: r.claimedUserId === null,
  }));
}

/** One entry in the group's match history — the view-model a MatchResultBlock needs. */
export interface RecentMatch {
  matchId: string;
  playedAt: Date;
  /** Casual matches show a label and never moved any rating (ADR-0007 replay skips them). */
  classification: "competitive" | "casual";
  /** Display names per side; one (singles) or two (doubles). */
  sideA: string[];
  sideB: string[];
  winnerSide: MatchSide;
}

/**
 * The group's recent matches, newest first — the board's activity strip
 * (screens.md §2). Reads the source-of-truth `match` + `match_participant` (not the
 * projection), joined to `player` for names; voided matches are excluded, casual
 * ones kept and flagged. Mirrors `logMatch`'s stream load, shaped for display: this
 * is how a Casual match "appears in history" while leaving the leaderboard untouched.
 */
export async function getRecentMatches(
  groupId: string,
  limit = 20,
  db: Database = getDb(),
): Promise<RecentMatch[]> {
  const matchRows = await db
    .select({
      id: match.id,
      playedAt: match.playedAt,
      classification: match.classification,
      winnerSide: match.winnerSide,
    })
    .from(match)
    .where(and(eq(match.groupId, groupId), ne(match.status, "voided")))
    .orderBy(desc(match.playedAt))
    .limit(limit);
  if (matchRows.length === 0) return [];

  const participantRows = await db
    .select({
      matchId: matchParticipant.matchId,
      side: matchParticipant.side,
      name: player.displayName,
    })
    .from(matchParticipant)
    .innerJoin(player, eq(player.id, matchParticipant.playerId))
    .where(
      inArray(
        matchParticipant.matchId,
        matchRows.map((m) => m.id),
      ),
    );

  const sidesByMatch = new Map<string, { A: string[]; B: string[] }>();
  for (const m of matchRows) sidesByMatch.set(m.id, { A: [], B: [] });
  for (const p of participantRows) sidesByMatch.get(p.matchId)![p.side].push(p.name);

  return matchRows.map((m) => {
    if (m.winnerSide === null) {
      // Every match has a winner (ADR-0003); a null here is a corrupt row.
      throw new Error(`getRecentMatches: match ${m.id} has no winner`);
    }
    const sides = sidesByMatch.get(m.id)!;
    return {
      matchId: m.id,
      playedAt: m.playedAt,
      classification: m.classification,
      sideA: sides.A,
      sideB: sides.B,
      winnerSide: m.winnerSide,
    };
  });
}

/** A Player's standing within one group — what their Profile reads. */
export interface PlayerStanding {
  /** Full-precision rating from the projection; the route rounds for display. */
  rating: number;
  competitiveMatchesPlayed: number;
  isRanked: boolean;
  isProvisional: boolean;
  /** Signed change from their most recent competitive match, or null if none yet. */
  lastDelta: number | null;
}

/**
 * One Player's standing in a group, or null if they have no rated match yet. Reads
 * the `current_rating` projection for the number, and the latest `rating_history`
 * row (by `played_at`) for the delta pill (screens.md §6 — the "+14!" payoff).
 * `rating_history` holds competitive matches only (casual matches never produce a
 * row), so `lastDelta` is always the last *rating-affecting* result.
 */
export async function getPlayerStanding(
  args: { groupId: string; playerId: string },
  db: Database = getDb(),
): Promise<PlayerStanding | null> {
  const [rating] = await db
    .select({
      rating: currentRating.rating,
      competitiveMatchesPlayed: currentRating.competitiveMatchesPlayed,
      isRanked: currentRating.isRanked,
      isProvisional: currentRating.isProvisional,
    })
    .from(currentRating)
    .where(
      and(
        eq(currentRating.groupId, args.groupId),
        eq(currentRating.playerId, args.playerId),
      ),
    )
    .limit(1);
  if (!rating) return null;

  const [last] = await db
    .select({ delta: ratingHistory.delta })
    .from(ratingHistory)
    .where(
      and(
        eq(ratingHistory.groupId, args.groupId),
        eq(ratingHistory.playerId, args.playerId),
      ),
    )
    .orderBy(desc(ratingHistory.playedAt))
    .limit(1);

  return {
    rating: Number(rating.rating),
    competitiveMatchesPlayed: rating.competitiveMatchesPlayed,
    isRanked: rating.isRanked,
    isProvisional: rating.isProvisional,
    lastDelta: last ? Number(last.delta) : null,
  };
}
