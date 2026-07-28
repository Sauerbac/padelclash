import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { SetScore } from "../../domain/set-score";

// Roster of the circle. No accounts: a Player is just a row, and access is a
// separate artifact (device_bindings below). See spec "Identity & access".
export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    // The case-folded key from domain/player-name.ts. Uniqueness is enforced
    // here rather than in application code so concurrent joins can't both win.
    normalizedName: text("normalized_name").notNull(),
    avatar: text("avatar"),
    // Retired players are hidden from pickers but keep their match history —
    // and keep reserving their name (spec decision 30).
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("players_normalized_name_key").on(t.normalizedName)],
);

export const invitationKind = pgEnum("invitation_kind", [
  "general",
  "personal",
]);

/**
 * Onboarding Links (spec "Onboarding Links"). Unlike a Device Binding, the
 * token is stored in the clear: Admin must be able to re-copy a live link
 * (decisions 36 and 40), which a hash cannot reproduce. The exposure is
 * bounded — a leaked row buys onboarding capability for at most the link's
 * 12 h / 7 d lifetime, and Admin can revoke it.
 */
export const onboardingInvitations = pgTable(
  "onboarding_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: invitationKind("kind").notNull(),
    // The invited Player for a Personal Link; null for the circle-wide
    // General Link (see the check constraint below).
    playerId: uuid("player_id").references(() => players.id, {
      onDelete: "cascade",
    }),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // Single-use: set by the join that spends a Personal Link. A General Link
    // onboards several Players, so it is never consumed — only expired/revoked.
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "onboarding_invitations_player_matches_kind",
      sql`(${t.kind} = 'personal' and ${t.playerId} is not null)
          or (${t.kind} = 'general' and ${t.playerId} is null)`,
    ),
    // At most one valid Personal Link per Player (spec decision 40). Expiry
    // isn't in the predicate — a moving target like now() can't be indexed —
    // so issuing a replacement explicitly revokes the previous row first.
    uniqueIndex("onboarding_invitations_one_active_personal")
      .on(t.playerId)
      .where(
        sql`kind = 'personal' and revoked_at is null and consumed_at is null`,
      ),
    // At most one General Link for the whole circle (spec decision 36). Same
    // deal: generating the next one revokes the expired predecessor.
    uniqueIndex("onboarding_invitations_one_active_general")
      .on(t.kind)
      .where(sql`kind = 'general' and revoked_at is null`),
  ],
);

/**
 * Device Bindings (spec "Device Binding"): the one active bearer credential
 * authorizing access as a Player. Only the hash is stored — the plaintext
 * exists solely in the holder's HttpOnly cookie. Revoked rows are kept for the
 * troubleshooting history of decision 53.
 */
export const deviceBindings = pgTable(
  "device_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    // Which invitation created this binding — accountability that survives the
    // invitation being superseded.
    createdViaInvitationId: uuid("created_via_invitation_id").references(
      () => onboardingInvitations.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    // One active binding per Player (spec decision 28), enforced by the
    // database so a race between two confirmations can't produce two.
    uniqueIndex("device_bindings_one_active_per_player")
      .on(t.playerId)
      .where(sql`revoked_at is null`),
    index("device_bindings_player_idx").on(t.playerId),
  ],
);

export const matchSide = pgEnum("match_side", ["A", "B"]);

// The match log — the source of truth (spec "Match"). Ratings are never stored
// on it; they are derived by replay into the projection tables below.
export const matches = pgTable("matches", {
  // Client-generated UUIDv7: the idempotency key for offline sync, and the
  // final tiebreaker of the replay's total order (playedAt, loggedAt, id).
  id: uuid("id").primaryKey(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  loggedBy: uuid("logged_by")
    .notNull()
    .references(() => players.id),
  winnerSide: matchSide("winner_side").notNull(),
  // Set Score detail; null = Simple Result (winner only, first-class).
  sets: jsonb("sets").$type<SetScore[]>(),
});

export const matchParticipants = pgTable(
  "match_participants",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    // Exactly one identity variant is present (check below).
    playerId: uuid("player_id").references(() => players.id),
    guestName: text("guest_name"),
    guestNormalizedName: text("guest_normalized_name"),
    side: matchSide("side").notNull(),
    slot: integer("slot").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.side, t.slot] }),
    check(
      "match_participants_exactly_one_identity",
      sql`(${t.playerId} is not null and ${t.guestName} is null and ${t.guestNormalizedName} is null)
          or (${t.playerId} is null and ${t.guestName} is not null and ${t.guestNormalizedName} is not null)`,
    ),
    uniqueIndex("match_participants_one_player_per_match")
      .on(t.matchId, t.playerId)
      .where(sql`player_id is not null`),
    uniqueIndex("match_participants_one_guest_name_per_match")
      .on(t.matchId, t.guestNormalizedName)
      .where(sql`guest_normalized_name is not null`),
  ],
);

// ---- Projections (derived, rewritten wholesale on every log change) --------
// Column-for-column images of the engine's output types (ParticipantOutput /
// CurrentRating in src/domain/rating/engine.ts). Never patched in place.

export const ratingHistory = pgTable(
  "rating_history",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    side: matchSide("side").notNull(),
    ratingBefore: integer("rating_before").notNull(),
    delta: integer("delta").notNull(),
    ratingAfter: integer("rating_after").notNull(),
    wasProvisional: boolean("was_provisional").notNull(),
    expectedScore: doublePrecision("expected_score").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
);

export const currentRating = pgTable("current_rating", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id),
  rating: integer("rating").notNull(),
  competitiveMatchesPlayed: integer("competitive_matches_played").notNull(),
  matchesSinceReset: integer("matches_since_reset").notNull(),
  isProvisional: boolean("is_provisional").notNull(),
  isRanked: boolean("is_ranked").notNull(),
  lastMatchAt: timestamp("last_match_at", { withTimezone: true }),
});

export type Player = typeof players.$inferSelect;
export type DeviceBinding = typeof deviceBindings.$inferSelect;
export type OnboardingInvitation = typeof onboardingInvitations.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type RatingHistoryRow = typeof ratingHistory.$inferSelect;
export type CurrentRatingRow = typeof currentRating.$inferSelect;
