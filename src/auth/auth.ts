// Better Auth wiring (slice 06) — the server-side auth instance.
//
// Two sign-up paths exist in the domain (ADR-0004): fresh registration creates a
// `player` AND a `user` together; claim-via-invite creates only a `user` linked to
// a pre-existing `player`. THIS slice is the fresh-registration path. The link is
// the not-null `user.player_id` FK we own on Better Auth's `user` table — every
// Account maps to exactly one Player.
//
// The mechanism: a `user.create.before` database hook mints a `player` row and
// returns its id as `playerId`, so the row Better Auth inserts already carries the
// link. `playerId` is declared as an additional field (input:false — a client can
// never set it) so the adapter persists what the hook returns. The DB's NOT NULL
// is the backstop: if the hook ever failed to provide it, the insert fails loud.
//
// `createAuth` takes its db + email sender + secrets explicitly so the Tier-3 test
// can build an instance against `padelclash_test` with a capturing sender. The
// production singleton (`getAuth`) is LAZY — it resolves the db, env, and sender
// only on first use, so `next build` (no env, no DB) never constructs it.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, type Database } from "@/db/client";
import { newId } from "@/db/ids";
import { player } from "@/db/schema";
import * as schema from "@/db/schema";
import { serverEnv } from "@/env";
import { getEmailSender, type EmailSender } from "@/services/email";

export interface CreateAuthOptions {
  db: Database;
  emailSender: EmailSender;
  secret: string;
  baseURL: string;
  /** Present only when both Google credentials are configured (ADR-0012). */
  google?: { clientId: string; clientSecret: string };
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Build a Better Auth instance over the given db and email sender. Pure of env
 * and process state — every dependency is an argument — so it is equally usable
 * in production (via `getAuth`) and in the integration test.
 */
export function createAuth(options: CreateAuthOptions) {
  const { db, emailSender, secret, baseURL, google } = options;

  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),

    emailAndPassword: {
      enabled: true,
      // Email+password is the primary path (ADR-0012). A login is refused until
      // the address is verified; sign-up does not auto-create a session.
      requireEmailVerification: true,
      autoSignIn: false,
    },

    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await emailSender.send({
          to: user.email,
          subject: "Verify your PadelClash email",
          text:
            `Welcome to PadelClash!\n\n` +
            `Confirm your email address to finish signing up:\n\n${url}\n\n` +
            `If you didn't create an account, you can ignore this email.`,
        });
      },
    },

    // Google is offered only when its credentials are present (ADR-0012). The
    // before-hook below links a Player for OAuth sign-ups too, so the path is
    // ready even though no Google button ships in this slice.
    ...(google
      ? {
          socialProviders: {
            google: {
              clientId: google.clientId,
              clientSecret: google.clientSecret,
            },
          },
        }
      : {}),

    user: {
      additionalFields: {
        // The FK we own (ADR-0004). input:false → only the hook may set it;
        // required:false here because the hook always supplies it and the DB
        // NOT NULL is the real guarantee.
        playerId: { type: "string", required: false, input: false },
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Fresh registration: mint the Player this Account anchors to. Its
            // display name seeds from the registered name (editable later on the
            // Profile). All match/rating history will reference this player id.
            const playerId = newId();
            await db.insert(player).values({
              id: playerId,
              displayName: user.name,
            });
            return { data: { ...user, playerId } };
          },
        },
      },
    },
  });
}

let cached: Auth | undefined;

/**
 * The process-wide auth instance. Lazy: constructs nothing until the first
 * request, so the env- and DB-free `next build` never touches it.
 */
export function getAuth(): Auth {
  if (!cached) {
    const env = serverEnv();
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    cached = createAuth({
      db: getDb(),
      emailSender: getEmailSender(),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      google: clientId && clientSecret ? { clientId, clientSecret } : undefined,
    });
  }
  return cached;
}
