CREATE TYPE "public"."match_side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TABLE "current_rating" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"rating" double precision NOT NULL,
	"competitive_matches_played" integer NOT NULL,
	"matches_since_reset" integer NOT NULL,
	"is_provisional" boolean NOT NULL,
	"is_ranked" boolean NOT NULL,
	"last_match_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"side" "match_side" NOT NULL,
	CONSTRAINT "match_participants_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_by" uuid NOT NULL,
	"winner_side" "match_side" NOT NULL,
	"sets" jsonb
);
--> statement-breakpoint
CREATE TABLE "rating_history" (
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"side" "match_side" NOT NULL,
	"rating_before" double precision NOT NULL,
	"delta" double precision NOT NULL,
	"rating_after" double precision NOT NULL,
	"was_provisional" boolean NOT NULL,
	"win_probability" double precision NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rating_history_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "current_rating" ADD CONSTRAINT "current_rating_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_logged_by_players_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;