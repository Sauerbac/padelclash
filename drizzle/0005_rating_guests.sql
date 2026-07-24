ALTER TABLE "match_participants" DROP CONSTRAINT "match_participants_match_id_player_id_pk";--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "guest_name" text;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "guest_normalized_name" text;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "slot" integer;--> statement-breakpoint
WITH numbered AS (
  SELECT "match_id", "player_id", "side",
         row_number() OVER (
           PARTITION BY "match_id", "side" ORDER BY "player_id"
         ) - 1 AS "slot"
    FROM "match_participants"
)
UPDATE "match_participants" AS participant
   SET "slot" = numbered."slot"
  FROM numbered
 WHERE participant."match_id" = numbered."match_id"
   AND participant."player_id" = numbered."player_id";--> statement-breakpoint
ALTER TABLE "match_participants" ALTER COLUMN "slot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "match_participants" ALTER COLUMN "player_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_side_slot_pk" PRIMARY KEY("match_id","side","slot");--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_exactly_one_identity" CHECK (("player_id" is not null and "guest_name" is null and "guest_normalized_name" is null)
          or ("player_id" is null and "guest_name" is not null and "guest_normalized_name" is not null));--> statement-breakpoint
CREATE UNIQUE INDEX "match_participants_one_player_per_match" ON "match_participants" USING btree ("match_id","player_id") WHERE player_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "match_participants_one_guest_name_per_match" ON "match_participants" USING btree ("match_id","guest_normalized_name") WHERE guest_normalized_name is not null;--> statement-breakpoint
ALTER TABLE "rating_history" RENAME COLUMN "win_probability" TO "expected_score";--> statement-breakpoint
ALTER TABLE "rating_history" ALTER COLUMN "rating_before" SET DATA TYPE integer USING round("rating_before")::integer;--> statement-breakpoint
ALTER TABLE "rating_history" ALTER COLUMN "delta" SET DATA TYPE integer USING round("delta")::integer;--> statement-breakpoint
ALTER TABLE "rating_history" ALTER COLUMN "rating_after" SET DATA TYPE integer USING round("rating_after")::integer;--> statement-breakpoint
ALTER TABLE "current_rating" ALTER COLUMN "rating" SET DATA TYPE integer USING round("rating")::integer;
