CREATE TYPE "public"."invitation_kind" AS ENUM('general', 'personal');--> statement-breakpoint
CREATE TABLE "device_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_via_invitation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "device_bindings_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "onboarding_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "invitation_kind" NOT NULL,
	"player_id" uuid,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "onboarding_invitations_token_unique" UNIQUE("token"),
	CONSTRAINT "onboarding_invitations_player_matches_kind" CHECK (("onboarding_invitations"."kind" = 'personal' and "onboarding_invitations"."player_id" is not null)
          or ("onboarding_invitations"."kind" = 'general' and "onboarding_invitations"."player_id" is null))
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "normalized_name" text;--> statement-breakpoint
-- Backfill display name and folding key, mirroring domain/player-name.ts step
-- for step: NFKC, drop every Unicode format character (Cf), collapse remaining
-- whitespace and controls, trim, then case-fold for the key. Added nullable
-- first because existing rows have no value yet.
--
-- The character class is the complete Cf set (Unicode 15, 21 ranges) rather
-- than a hand-picked handful. Postgres regex has no \p{Cf}, and anything less
-- than the full set would let a legacy name keep an invisible character the
-- runtime strips — U+202E and friends — so the row's stored key would differ
-- from what the app computes, and two apparently identical names could coexist.
UPDATE "players" p SET "name" = c.cleaned, "normalized_name" = lower(c.cleaned) FROM (SELECT "id", btrim(regexp_replace(regexp_replace(normalize("name", NFKC), E'[\u00AD\u0600-\u0605\u061C\u06DD\u070F\u0890-\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB\U000110BD\U000110CD\U00013430-\U0001343F\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0001\U000E0020-\U000E007F]', '', 'g'), '[[:space:][:cntrl:]]+', ' ', 'g')) AS cleaned FROM "players" p) c WHERE p."id" = c."id";--> statement-breakpoint
DO $$
DECLARE
  disambiguated integer;
BEGIN
  -- Player Names only became case-insensitively unique in spec decision 30, so
  -- rows predating it may now collide. Rather than failing the migration (which
  -- would brick boot) or silently dropping a Player, the later duplicates get a
  -- visible " (2)", " (3)" suffix on BOTH the display name and the key: Admin
  -- sees exactly which rows need a real rename. Looped, because a suffixed name
  -- can itself collide with an existing one.
  LOOP
    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY "normalized_name" ORDER BY "created_at", "id"
             ) AS n
        FROM "players"
    )
    UPDATE "players" p
       SET "name" = p."name" || ' (' || r.n || ')',
           "normalized_name" = p."normalized_name" || ' (' || r.n || ')'
      FROM ranked r
     WHERE p."id" = r."id" AND r.n > 1;

    GET DIAGNOSTICS disambiguated = ROW_COUNT;
    EXIT WHEN disambiguated = 0;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "players" ALTER COLUMN "normalized_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "device_bindings" ADD CONSTRAINT "device_bindings_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_bindings" ADD CONSTRAINT "device_bindings_created_via_invitation_id_onboarding_invitations_id_fk" FOREIGN KEY ("created_via_invitation_id") REFERENCES "public"."onboarding_invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_invitations" ADD CONSTRAINT "onboarding_invitations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_bindings_one_active_per_player" ON "device_bindings" USING btree ("player_id") WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX "device_bindings_player_idx" ON "device_bindings" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_invitations_one_active_personal" ON "onboarding_invitations" USING btree ("player_id") WHERE kind = 'personal' and revoked_at is null and consumed_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_invitations_one_active_general" ON "onboarding_invitations" USING btree ("kind") WHERE kind = 'general' and revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "players_normalized_name_key" ON "players" USING btree ("normalized_name");