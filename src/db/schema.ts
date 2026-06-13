// Drizzle schema — the single source of truth for the database shape.
//
// Two families of tables live here:
//   1. The domain core + replay projections, from docs/architecture/data-model.md
//      and docs/architecture/rating-engine.md (slice 02).
//   2. Better Auth's own tables (user/session/account/verification), extended
//      with the one FK we own — user.player_id — per ADR-0004. Better Auth wires
//      its runtime against these in slice 06; here we only define the shape so the
//      migration can create them.
//
// Convention: camelCase JS keys (Better Auth matches its model fields by these
// names) mapped to snake_case columns. Domain ids are app-generated UUIDv7
// (`uuid`, no DB default); Better Auth ids are its own string ids (`text`).

import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────────

/** Court-side preference and handedness both range over left/right. */
export const leftRight = pgEnum("left_right", ["left", "right"]);
/** Which side of a match a participant plays on. */
export const matchSide = pgEnum("match_side", ["A", "B"]);
export const membershipRole = pgEnum("membership_role", ["admin", "member"]);
export const membershipStatus = pgEnum("membership_status", ["active", "former"]);
export const matchClassification = pgEnum("match_classification", [
  "competitive",
  "casual",
]);
export const matchStatus = pgEnum("match_status", [
  "pending",
  "confirmed",
  "contested",
  "voided",
]);
export const resultFormat = pgEnum("result_format", ["set", "points", "simple"]);

// ── Domain core ────────────────────────────────────────────────────────────────

/**
 * Player — the domain anchor every match, rating and membership references
 * (ADR-0004). Carries no auth columns. An Unclaimed Player is simply a row no
 * `user` references yet.
 */
export const player = pgTable("player", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  preferredSide: leftRight("preferred_side"),
  handedness: leftRight("handedness"),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Group — the rating boundary (ADR-0002). Settings drive engine/policy behavior. */
export const group = pgTable("group", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  trustMode: boolean("trust_mode").notNull().default(true),
  seasonConfig: jsonb("season_config"),
  rankedThreshold: integer("ranked_threshold").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Membership — the (group, player) join. Unclaimed Players have rows too. A
 * Former Member keeps its row at status=former (history stays, leaderboard drops).
 */
export const membership = pgTable(
  "membership",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => player.id),
    role: membershipRole("role").notNull(),
    status: membershipStatus("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.playerId] })],
);

/**
 * Match — the source of truth (ADR-0001/0003). `result` is a jsonb whose shape
 * is pinned by a discriminated union in the domain core, keyed by `resultFormat`.
 * `logged_at` is immutable; `played_at` is editable and drives replay ordering.
 */
export const match = pgTable("match", {
  id: uuid("id").primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => group.id),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  loggedBy: uuid("logged_by")
    .notNull()
    .references(() => player.id),
  classification: matchClassification("classification").notNull(),
  status: matchStatus("status").notNull(),
  resultFormat: resultFormat("result_format").notNull(),
  result: jsonb("result").notNull(),
  winnerSide: matchSide("winner_side"),
});

/**
 * MatchParticipant — one or two rows per side covers singles and doubles
 * uniformly. Source data; stays separate from the rating_history projection
 * even though both key on (match, player) (ADR-0007: source ≠ projection).
 */
export const matchParticipant = pgTable(
  "match_participant",
  {
    matchId: uuid("match_id")
      .notNull()
      .references(() => match.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => player.id),
    side: matchSide("side").notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
);

// ── Replay projections ─────────────────────────────────────────────────────────
// Formal caches — droppable and rebuilt by full replay of a group inside the
// same transaction as the mutation (ADR-0007). Ratings stored at full precision
// (numeric); rounded only for display.

/**
 * current_rating — the end-state of the replay loop, written out. One row per
 * (group, player). What the Leaderboard and Win Probability read.
 * `is_ranked` = the ≥3-competitive-match threshold (CONTEXT / data-model).
 */
export const currentRating = pgTable(
  "current_rating",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => player.id),
    rating: numeric("rating").notNull(),
    competitiveMatchesPlayed: integer("competitive_matches_played")
      .notNull()
      .default(0),
    matchesSinceReset: integer("matches_since_reset").notNull().default(0),
    isProvisional: boolean("is_provisional").notNull(),
    isRanked: boolean("is_ranked").notNull(),
    lastMatchAt: timestamp("last_match_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.playerId] })],
);

/**
 * rating_history — the engine's per-match output, one row per (match,
 * participant). Powers the rating graph, the "+14!" feedback, and the per-match
 * audit. `played_at` is denormalized so the graph orders without joining back.
 */
export const ratingHistory = pgTable(
  "rating_history",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => group.id),
    matchId: uuid("match_id")
      .notNull()
      .references(() => match.id),
    playerId: uuid("player_id")
      .notNull()
      .references(() => player.id),
    side: matchSide("side").notNull(),
    ratingBefore: numeric("rating_before").notNull(),
    delta: numeric("delta").notNull(),
    ratingAfter: numeric("rating_after").notNull(),
    wasProvisional: boolean("was_provisional").notNull(),
    winProbability: numeric("win_probability").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
);

// ── Better Auth ──────────────────────────────────────────────────────────────
// Better Auth's core schema (user/session/account/verification). We own exactly
// one addition: user.player_id — unique, not-null FK to player (ADR-0004). The
// auth runtime is configured in slice 06 against these tables.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // The one FK we own: every Account maps to exactly one Player (ADR-0004).
  playerId: uuid("player_id")
    .notNull()
    .unique()
    .references(() => player.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
