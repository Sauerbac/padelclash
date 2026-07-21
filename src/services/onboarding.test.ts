import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  closeTestDb,
  getTestDb,
  hasDatabase,
  truncateAll,
} from "./db/test-db";
import type { Db } from "./db";
import { deviceBindings, onboardingInvitations } from "./db/schema";
import {
  GENERAL_LINK_TTL_MS,
  PERSONAL_LINK_TTL_MS,
} from "../domain/onboarding";
import { hashToken } from "./auth/credentials";
import {
  createBinding,
  getActiveBinding,
  resolveCredential,
} from "./access";
import {
  confirmJoin,
  generateGeneralLink,
  generatePersonalLink,
  getGeneralLink,
  getPersonalLink,
  previewInvitation,
  revokeAccess,
  revokeGeneralLink,
  revokePersonalLink,
} from "./onboarding";
import { createPlayer, isJoined, retirePlayer } from "./players";

afterAll(closeTestDb);

const NOW = new Date("2026-07-21T12:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

/** Unwraps a General Link generation that is expected to succeed. */
async function generalLink(db: Db, now = NOW) {
  const result = await generateGeneralLink(db, now);
  if (!result.ok) throw new Error(`expected a link, got ${result.error}`);
  return result.link;
}

describe.skipIf(!hasDatabase)("general onboarding link", () => {
  let db: Db;
  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("issues one link valid for 12 hours", async () => {
    const link = await generalLink(db);
    expect(link.token.length).toBeGreaterThanOrEqual(32);
    expect(link.expiresAt.getTime()).toBe(NOW.getTime() + GENERAL_LINK_TTL_MS);
  });

  it("refuses a second link while one is live, but keeps it copyable", async () => {
    const first = await generalLink(db);

    // Spec decision 36: copy the live one; generate another only after it dies.
    expect(await generateGeneralLink(db, NOW)).toEqual({
      ok: false,
      error: "already-active",
    });
    expect((await getGeneralLink(db, NOW))?.token).toBe(first.token);
  });

  it("allows a new link once the old one expired", async () => {
    const first = await generalLink(db);
    const afterExpiry = later(GENERAL_LINK_TTL_MS + 1);

    expect(await getGeneralLink(db, afterExpiry)).toBeNull();
    const second = await generalLink(db, afterExpiry);
    expect(second.token).not.toBe(first.token);

    // The expired predecessor is dead, not merely stale.
    expect(await previewInvitation(db, first.token, afterExpiry)).toEqual({
      ok: false,
      error: "revoked",
    });
  });

  it("allows a new link immediately after revocation", async () => {
    const first = await generalLink(db);
    await revokeGeneralLink(db, NOW);

    expect(await getGeneralLink(db, NOW)).toBeNull();
    expect(await previewInvitation(db, first.token, NOW)).toEqual({
      ok: false,
      error: "revoked",
    });
    expect((await generalLink(db)).token).not.toBe(first.token);
  });

  it("offers only not-joined players to pick from", async () => {
    const simon = await createPlayer(db, "Simon");
    const alex = await createPlayer(db, "Alex");
    const jo = await createPlayer(db, "Jo");
    await createBinding(db, alex.id, { now: NOW });
    await retirePlayer(db, jo.id);

    const link = await generalLink(db);
    const result = await previewInvitation(db, link.token, NOW);

    expect(result.ok && result.preview.kind).toBe("general");
    expect(
      result.ok && result.preview.kind === "general"
        ? result.preview.notJoined.map((p) => p.id)
        : [],
    ).toEqual([simon.id]);
  });
});

describe.skipIf(!hasDatabase)("personal onboarding link", () => {
  let db: Db;
  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("issues a link valid for 7 days, targeted at one player", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);

    expect(link.expiresAt.getTime()).toBe(NOW.getTime() + PERSONAL_LINK_TTL_MS);

    const result = await previewInvitation(db, link.token, NOW);
    expect(result).toEqual({
      ok: true,
      preview: {
        kind: "personal",
        player: { id: simon.id, name: "Simon" },
        replacesBinding: false,
      },
    });
  });

  it("replacing revokes the old link and restarts the 7-day window", async () => {
    const simon = await createPlayer(db, "Simon");
    const first = await generatePersonalLink(db, simon.id, NOW);

    const oneDayLater = later(24 * 60 * 60 * 1000);
    const second = await generatePersonalLink(db, simon.id, oneDayLater);

    // Spec decision 40: at most one valid link per Player.
    expect(second.token).not.toBe(first.token);
    expect(await previewInvitation(db, first.token, oneDayLater)).toEqual({
      ok: false,
      error: "revoked",
    });
    expect(second.expiresAt.getTime()).toBe(
      oneDayLater.getTime() + PERSONAL_LINK_TTL_MS,
    );
    expect((await getPersonalLink(db, simon.id, oneDayLater))?.token).toBe(
      second.token,
    );
  });

  it("replacing a device leaves the current binding live until the link is used", async () => {
    const simon = await createPlayer(db, "Simon");
    const { credential: old } = await createBinding(db, simon.id, { now: NOW });

    const link = await generatePersonalLink(db, simon.id, NOW);

    // Spec decision 45: "Replace device" doesn't lock anyone out pre-emptively.
    expect(await resolveCredential(db, old)).not.toBeNull();

    const preview = await previewInvitation(db, link.token, NOW);
    expect(preview.ok && preview.preview.kind === "personal"
      ? preview.preview.replacesBinding
      : null).toBe(true);

    const join = await confirmJoin(db, { via: "personal", token: link.token }, NOW);
    expect(join.ok).toBe(true);

    // ...and the moment it is used, the old credential dies.
    expect(await resolveCredential(db, old)).toBeNull();
  });

  it("expires after 7 days", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);
    const afterExpiry = later(PERSONAL_LINK_TTL_MS + 1);

    expect(await previewInvitation(db, link.token, afterExpiry)).toEqual({
      ok: false,
      error: "expired",
    });
    expect(
      await confirmJoin(db, { via: "personal", token: link.token }, afterExpiry),
    ).toEqual({ ok: false, error: "expired" });
    expect(await isJoined(db, simon.id)).toBe(false);
  });

  it("is revocable, and a revoked link joins nobody", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);
    await revokePersonalLink(db, simon.id, NOW);

    expect(
      await confirmJoin(db, { via: "personal", token: link.token }, NOW),
    ).toEqual({ ok: false, error: "revoked" });
    expect(await isJoined(db, simon.id)).toBe(false);
  });

  it("refuses to invite a retired player", async () => {
    const jo = await createPlayer(db, "Jo");
    await retirePlayer(db, jo.id);
    await expect(generatePersonalLink(db, jo.id, NOW)).rejects.toThrow();
  });
});

describe.skipIf(!hasDatabase)("join confirmation", () => {
  let db: Db;
  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("previewing never consumes the invitation", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);

    // Spec decision 42: opening or refreshing is a pure read.
    await previewInvitation(db, link.token, NOW);
    await previewInvitation(db, link.token, NOW);

    expect(await isJoined(db, simon.id)).toBe(false);
    const join = await confirmJoin(db, { via: "personal", token: link.token }, NOW);
    expect(join.ok).toBe(true);
  });

  it("a personal join binds the player and consumes the link", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);

    const join = await confirmJoin(db, { via: "personal", token: link.token }, NOW);
    expect(join.ok && join.playerName).toBe("Simon");

    if (!join.ok) throw new Error("expected a join");
    expect((await resolveCredential(db, join.credential))?.player.id).toBe(
      simon.id,
    );

    // Single use (spec decision 32).
    expect(
      await confirmJoin(db, { via: "personal", token: link.token }, NOW),
    ).toEqual({ ok: false, error: "consumed" });
  });

  it("stores only the credential's hash, never the credential", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);
    const join = await confirmJoin(db, { via: "personal", token: link.token }, NOW);
    if (!join.ok) throw new Error("expected a join");

    const [binding] = await db
      .select()
      .from(deviceBindings)
      .where(eq(deviceBindings.playerId, simon.id));

    // Spec decision 47: a leaked database grants nobody access.
    expect(binding.tokenHash).not.toBe(join.credential);
    expect(binding.tokenHash).toBe(hashToken(join.credential));
    expect(binding.createdViaInvitationId).not.toBeNull();
  });

  it("a general join binds an existing not-joined player", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generalLink(db);

    const join = await confirmJoin(
      db,
      { via: "general-existing", token: link.token, playerId: simon.id },
      NOW,
    );
    expect(join.ok && join.playerId).toBe(simon.id);
    expect(await isJoined(db, simon.id)).toBe(true);

    // The General Link onboards several people, so it survives (decision 29).
    expect((await getGeneralLink(db, NOW))?.token).toBe(link.token);
  });

  it("a general link cannot take over a player who already joined", async () => {
    const simon = await createPlayer(db, "Simon");
    await createBinding(db, simon.id, { now: NOW });
    const link = await generalLink(db);

    expect(
      await confirmJoin(
        db,
        { via: "general-existing", token: link.token, playerId: simon.id },
        NOW,
      ),
    ).toEqual({ ok: false, error: "player-already-joined" });
  });

  it("a general join creates and immediately binds a new player", async () => {
    const link = await generalLink(db);

    const join = await confirmJoin(
      db,
      { via: "general-new", token: link.token, name: "  Simon  " },
      NOW,
    );
    expect(join.ok && join.playerName).toBe("Simon");
    if (!join.ok) throw new Error("expected a join");
    expect(await isJoined(db, join.playerId)).toBe(true);
  });

  it("refuses a new player whose name collides, creating nothing", async () => {
    await createPlayer(db, "Simon");
    const link = await generalLink(db);

    expect(
      await confirmJoin(
        db,
        { via: "general-new", token: link.token, name: "SIMON" },
        NOW,
      ),
    ).toEqual({ ok: false, error: "name-taken" });

    // Spec decision 51: a failed confirmation leaves no partial Player.
    const roster = await db.select().from(deviceBindings);
    expect(roster).toHaveLength(0);
  });

  it("refuses a blank new name", async () => {
    const link = await generalLink(db);
    expect(
      await confirmJoin(
        db,
        { via: "general-new", token: link.token, name: "   " },
        NOW,
      ),
    ).toEqual({ ok: false, error: "name-blank" });
  });

  it("a general join invalidates the player's outstanding personal link", async () => {
    const simon = await createPlayer(db, "Simon");
    const personal = await generatePersonalLink(db, simon.id, NOW);
    const general = await generalLink(db);

    await confirmJoin(
      db,
      { via: "general-existing", token: general.token, playerId: simon.id },
      NOW,
    );

    // Spec decision 44: whichever route joins first wins.
    expect(await previewInvitation(db, personal.token, NOW)).toEqual({
      ok: false,
      error: "revoked",
    });
  });

  it("rejects a token used against the wrong flow", async () => {
    const simon = await createPlayer(db, "Simon");
    const personal = await generatePersonalLink(db, simon.id, NOW);
    const general = await generalLink(db);

    expect(
      await confirmJoin(
        db,
        { via: "general-existing", token: personal.token, playerId: simon.id },
        NOW,
      ),
    ).toEqual({ ok: false, error: "wrong-link-kind" });
    expect(
      await confirmJoin(db, { via: "personal", token: general.token }, NOW),
    ).toEqual({ ok: false, error: "wrong-link-kind" });
  });

  it("a bound installation can't join again, and doesn't spend the link", async () => {
    const simon = await createPlayer(db, "Simon");
    const alex = await createPlayer(db, "Alex");
    const { credential } = await createBinding(db, simon.id, { now: NOW });
    const link = await generatePersonalLink(db, alex.id, NOW);

    // Decision 38, enforced inside the transaction rather than merely checked
    // by the caller beforehand.
    expect(
      await confirmJoin(
        db,
        { via: "personal", token: link.token },
        NOW,
        credential,
      ),
    ).toEqual({ ok: false, error: "already-bound" });

    // The invitation survives untouched, and neither Player moved.
    expect((await getPersonalLink(db, alex.id, NOW))?.token).toBe(link.token);
    expect(await isJoined(db, alex.id)).toBe(false);
    expect((await resolveCredential(db, credential))?.player.id).toBe(simon.id);
  });

  it("a stale credential doesn't block a fresh join", async () => {
    const simon = await createPlayer(db, "Simon");
    const { credential } = await createBinding(db, simon.id, { now: NOW });
    await revokeAccess(db, simon.id, NOW);
    const link = await generatePersonalLink(db, simon.id, NOW);

    // The cookie is still in the browser, but it resolves to nothing — so it
    // must not be mistaken for a live installation (decision 52).
    const join = await confirmJoin(
      db,
      { via: "personal", token: link.token },
      NOW,
      credential,
    );
    expect(join.ok).toBe(true);
  });

  it("rejects an unknown token", async () => {
    expect(
      await confirmJoin(db, { via: "personal", token: "nonsense" }, NOW),
    ).toEqual({ ok: false, error: "not-found" });
  });

  it("refuses to join as a retired player", async () => {
    const jo = await createPlayer(db, "Jo");
    const link = await generalLink(db);
    await retirePlayer(db, jo.id);

    expect(
      await confirmJoin(
        db,
        { via: "general-existing", token: link.token, playerId: jo.id },
        NOW,
      ),
    ).toEqual({ ok: false, error: "player-unavailable" });
  });
});

describe.skipIf(!hasDatabase)("concurrent claims", () => {
  let db: Db;
  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("only one of two simultaneous claims on the same player wins", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generalLink(db);

    const results = await Promise.all([
      confirmJoin(
        db,
        { via: "general-existing", token: link.token, playerId: simon.id },
        NOW,
      ),
      confirmJoin(
        db,
        { via: "general-existing", token: link.token, playerId: simon.id },
        NOW,
      ),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, error: "player-already-joined" },
    ]);

    // One Player, one active binding — the invariant decision 28 promises.
    const active = await db
      .select()
      .from(deviceBindings)
      .where(eq(deviceBindings.playerId, simon.id));
    expect(active.filter((b) => b.revokedAt === null)).toHaveLength(1);
  });

  it("only one of two simultaneous claims on the same new name wins", async () => {
    const link = await generalLink(db);

    const results = await Promise.all([
      confirmJoin(db, { via: "general-new", token: link.token, name: "Simon" }, NOW),
      confirmJoin(db, { via: "general-new", token: link.token, name: "simon" }, NOW),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, error: "name-taken" },
    ]);
    expect(await db.select().from(deviceBindings)).toHaveLength(1);
  });

  it("revocation and confirmation never both take effect", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);

    const [join] = await Promise.all([
      confirmJoin(db, { via: "personal", token: link.token }, NOW),
      revokePersonalLink(db, simon.id, NOW),
    ]);

    // Whichever won, the end state must agree with it: a join that reported
    // success left a usable binding, and one that reported failure left none.
    // The state the onboarding lock exists to prevent is "revoked, and then
    // bound anyway".
    const binding = await getActiveBinding(db, simon.id);
    if (join.ok) {
      expect(binding).not.toBeNull();
      expect((await resolveCredential(db, join.credential))?.player.id).toBe(
        simon.id,
      );
    } else {
      expect(join.error).toBe("revoked");
      expect(binding).toBeNull();
    }
  });

  it("retirement and confirmation never both take effect", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);

    const [join] = await Promise.all([
      confirmJoin(db, { via: "personal", token: link.token }, NOW),
      retirePlayer(db, simon.id),
    ]);

    // A retired Player must never end up holding live access, whichever order
    // the two landed in.
    if (join.ok) {
      expect(await resolveCredential(db, join.credential)).toBeNull();
    }
    expect(await getActiveBinding(db, simon.id)).toBeNull();
  });

  it("a single-use personal link can only be spent once", async () => {
    const simon = await createPlayer(db, "Simon");
    const link = await generatePersonalLink(db, simon.id, NOW);

    const results = await Promise.all([
      confirmJoin(db, { via: "personal", token: link.token }, NOW),
      confirmJoin(db, { via: "personal", token: link.token }, NOW),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, error: "consumed" },
    ]);
  });
});

describe.skipIf(!hasDatabase)("emergency revocation", () => {
  let db: Db;
  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("revokes the binding, the personal link, and the general link", async () => {
    const simon = await createPlayer(db, "Simon");
    const { credential } = await createBinding(db, simon.id, { now: NOW });
    const personal = await generatePersonalLink(db, simon.id, NOW);
    const general = await generalLink(db);

    await revokeAccess(db, simon.id, NOW);

    // Spec decisions 45 and 46, all three together.
    expect(await resolveCredential(db, credential)).toBeNull();
    expect(await getActiveBinding(db, simon.id)).toBeNull();
    expect(await previewInvitation(db, personal.token, NOW)).toEqual({
      ok: false,
      error: "revoked",
    });
    expect(await previewInvitation(db, general.token, NOW)).toEqual({
      ok: false,
      error: "revoked",
    });
  });

  it("keeps revoked bindings as history", async () => {
    const simon = await createPlayer(db, "Simon");
    await createBinding(db, simon.id, { now: NOW });
    await revokeAccess(db, simon.id, NOW);
    await createBinding(db, simon.id, { now: later(1000) });

    // Spec decision 53: the trail survives for troubleshooting.
    const all = await db
      .select()
      .from(deviceBindings)
      .where(eq(deviceBindings.playerId, simon.id));
    expect(all).toHaveLength(2);
    expect(all.filter((b) => b.revokedAt !== null)).toHaveLength(1);
  });

  it("leaves other players' access alone", async () => {
    const simon = await createPlayer(db, "Simon");
    const alex = await createPlayer(db, "Alex");
    const { credential: simonCredential } = await createBinding(db, simon.id, {
      now: NOW,
    });
    const { credential: alexCredential } = await createBinding(db, alex.id, {
      now: NOW,
    });

    await revokeAccess(db, simon.id, NOW);

    expect(await resolveCredential(db, simonCredential)).toBeNull();
    expect((await resolveCredential(db, alexCredential))?.player.id).toBe(
      alex.id,
    );
  });
});

describe.skipIf(!hasDatabase)("database invariants", () => {
  let db: Db;
  beforeEach(async () => {
    db = await getTestDb();
    await truncateAll();
  });

  it("rejects two active bindings for one player", async () => {
    const simon = await createPlayer(db, "Simon");
    await db.insert(deviceBindings).values({
      playerId: simon.id,
      tokenHash: hashToken("one"),
    });
    // The partial unique index is the real guarantee behind decision 28 —
    // application code is not the only thing standing in the way.
    await expect(
      db.insert(deviceBindings).values({
        playerId: simon.id,
        tokenHash: hashToken("two"),
      }),
    ).rejects.toThrow();
  });

  it("rejects two valid personal links for one player", async () => {
    const simon = await createPlayer(db, "Simon");
    const values = {
      kind: "personal" as const,
      playerId: simon.id,
      expiresAt: later(PERSONAL_LINK_TTL_MS),
    };
    await db.insert(onboardingInvitations).values({ ...values, token: "a" });
    await expect(
      db.insert(onboardingInvitations).values({ ...values, token: "b" }),
    ).rejects.toThrow();
  });

  it("rejects two active general links", async () => {
    const values = {
      kind: "general" as const,
      playerId: null,
      expiresAt: later(GENERAL_LINK_TTL_MS),
    };
    await db.insert(onboardingInvitations).values({ ...values, token: "a" });
    await expect(
      db.insert(onboardingInvitations).values({ ...values, token: "b" }),
    ).rejects.toThrow();
  });

  it("rejects invitations whose kind and player disagree", async () => {
    const simon = await createPlayer(db, "Simon");
    // A personal link with no target, and a general link aimed at one player:
    // both are nonsense the check constraint refuses.
    await expect(
      db.insert(onboardingInvitations).values({
        kind: "personal",
        playerId: null,
        token: "a",
        expiresAt: later(PERSONAL_LINK_TTL_MS),
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(onboardingInvitations).values({
        kind: "general",
        playerId: simon.id,
        token: "b",
        expiresAt: later(GENERAL_LINK_TTL_MS),
      }),
    ).rejects.toThrow();
  });

  it("cascades bindings and invitations when a player is deleted", async () => {
    const simon = await createPlayer(db, "Simon");
    await createBinding(db, simon.id, { now: NOW });
    await generatePersonalLink(db, simon.id, NOW);

    const { deletePlayer } = await import("./players");
    await deletePlayer(db, simon.id);

    expect(await db.select().from(deviceBindings)).toHaveLength(0);
    expect(
      await db
        .select()
        .from(onboardingInvitations)
        .where(and(eq(onboardingInvitations.kind, "personal"))),
    ).toHaveLength(0);
  });
});
