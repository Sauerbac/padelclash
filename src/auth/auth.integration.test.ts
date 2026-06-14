// Tier-3 (ADR-0008 / ADR-0012): fresh registration against a real Postgres.
//
// Proves the ADR-0004 linkage the slice is about: signing up creates a Player AND
// an Account, the Account's not-null player_id points at that Player, and the
// verification email is sent through the injected EmailSender — all without a
// Resend key (the capturing stub stands in for the console adapter).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "./auth";
import { setupTestDb, type TestDb } from "@/db/test-db";
import { player as playerTable, user as userTable } from "@/db/schema";
import type { EmailMessage, EmailSender } from "@/services/email";

class CapturingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

let testDb: TestDb;
let email: CapturingEmailSender;
let auth: ReturnType<typeof createAuth>;

beforeAll(async () => {
  testDb = await setupTestDb();
  email = new CapturingEmailSender();
  auth = createAuth({
    db: testDb.db,
    emailSender: email,
    secret: "test-only-secret-which-is-quite-long-enough",
    baseURL: "http://localhost:3000",
  });
});

afterAll(async () => {
  await testDb.close();
});

beforeEach(async () => {
  await testDb.reset();
  email.sent.length = 0;
});

describe("fresh registration", () => {
  it("creates a player and an account linked by user.player_id", async () => {
    await auth.api.signUpEmail({
      body: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "correct-horse-battery",
      },
    });

    const players = await testDb.db.select().from(playerTable);
    const users = await testDb.db.select().from(userTable);

    expect(players).toHaveLength(1);
    expect(users).toHaveLength(1);

    // The Player is the domain anchor; its name seeds from registration.
    expect(players[0].displayName).toBe("Ada Lovelace");

    // The Account links to exactly that Player, and is unverified until the
    // emailed link is followed.
    expect(users[0].playerId).toBe(players[0].id);
    expect(users[0].email).toBe("ada@example.com");
    expect(users[0].emailVerified).toBe(false);
  });

  it("sends a verification email carrying a link", async () => {
    await auth.api.signUpEmail({
      body: {
        name: "Grace Hopper",
        email: "grace@example.com",
        password: "correct-horse-battery",
      },
    });

    // The send is awaited inside sign-up; give the microtask a beat just in case.
    await waitFor(() => email.sent.length > 0);

    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe("grace@example.com");
    expect(email.sent[0].text).toMatch(/https?:\/\/\S+/);
  });
});

/** Poll a predicate up to ~1s — for the fire-and-forget verification send. */
async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
}
