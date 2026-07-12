import {
  boolean,
  pgTable,
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

export type Player = typeof players.$inferSelect;
export type Settings = typeof settings.$inferSelect;
