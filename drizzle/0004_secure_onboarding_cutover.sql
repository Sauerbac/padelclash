-- The secure cutover of spec decision 55. Dropping `personal_token` kills every
-- reusable join link outright, and the raw Player-id cookie it paired with is a
-- different cookie name than the new credential, so no legacy cookie can be
-- upgraded into a Device Binding. device_bindings starts empty on purpose:
-- every existing Player begins Not Joined and needs a fresh invitation. No
-- General Link is created here either — Admin issues one deliberately.
-- `settings` held only the public name-picker toggle, which this slice removes.
ALTER TABLE "settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "settings" CASCADE;--> statement-breakpoint
ALTER TABLE "players" DROP CONSTRAINT "players_personal_token_unique";--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN "personal_token";