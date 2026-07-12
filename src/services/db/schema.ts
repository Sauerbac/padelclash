import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Roster of the circle. No accounts: a player is just a row, bound to devices
// via personal_token (see spec "Identity & access").
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  personalToken: text("personal_token").notNull().unique(),
  // Retired players are hidden from pickers but keep their match history.
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Single-row app settings. The fixed id makes "the one row" an upsert target.
export const SETTINGS_SINGLETON_ID = "singleton";

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default(SETTINGS_SINGLETON_ID),
  namePickerEnabled: boolean("name_picker_enabled").notNull().default(false),
});

export const matchSide = pgEnum("match_side", ["A", "B"]);

/** Games per set, side A vs side B — e.g. `{ a: 6, b: 4 }`. */
export interface SetScore {
  a: number;
  b: number;
}

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
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id),
    side: matchSide("side").notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
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
    ratingBefore: doublePrecision("rating_before").notNull(),
    delta: doublePrecision("delta").notNull(),
    ratingAfter: doublePrecision("rating_after").notNull(),
    wasProvisional: boolean("was_provisional").notNull(),
    winProbability: doublePrecision("win_probability").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.playerId] })],
);

export const currentRating = pgTable("current_rating", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id),
  rating: doublePrecision("rating").notNull(),
  competitiveMatchesPlayed: integer("competitive_matches_played").notNull(),
  matchesSinceReset: integer("matches_since_reset").notNull(),
  isProvisional: boolean("is_provisional").notNull(),
  isRanked: boolean("is_ranked").notNull(),
  lastMatchAt: timestamp("last_match_at", { withTimezone: true }),
});

export type Player = typeof players.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type RatingHistoryRow = typeof ratingHistory.$inferSelect;
export type CurrentRatingRow = typeof currentRating.$inferSelect;
