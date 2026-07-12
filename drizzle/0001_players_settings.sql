CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"avatar" text,
	"personal_token" text NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_personal_token_unique" UNIQUE("personal_token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"name_picker_enabled" boolean DEFAULT false NOT NULL
);
