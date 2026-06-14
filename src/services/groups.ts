// The groups application concern (module-structure.md): the create-group mutation
// and the reads the group screen needs. services/ is the only layer that knows
// both the domain and the database, so the membership-scoped queries and the
// leaderboard read off the `current_rating` projection live here, behind a small
// view-model surface the app layer maps to ui props.
//
// `db` is injectable (default the pooled client) so the Tier-3 integration test
// can target `padelclash_test`, exactly as `logMatch` does.

import { and, desc, eq } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { newId } from "@/db/ids";
import { currentRating, group, membership, player } from "@/db/schema";

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
