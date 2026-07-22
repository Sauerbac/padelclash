import { describe, expect, it } from "vitest";
import {
  handleRefusal,
  isPermanentRefusal,
  type MatchSyncRefusal,
} from "./sync-policy";

const ALL_REFUSALS: MatchSyncRefusal[] = [
  "not-bound",
  "identity-mismatch",
  "not-allowed",
  "rate-limited",
  "invalid",
];

describe("handleRefusal", () => {
  describe("a match queued by a different player", () => {
    const handling = handleRefusal("identity-mismatch");

    it("is permanent — re-attributing it is what decision 52 forbids", () => {
      expect(handling.permanent).toBe(true);
    });

    it("does not stop the rest of the backlog", () => {
      // The refusal concerns this one match's owner, not the connection or
      // the binding, so matches behind it can still go through.
      expect(handling.stopBatch).toBe(false);
    });
  });

  it("treats an invalid payload as permanent and item-local", () => {
    expect(handleRefusal("invalid")).toEqual({
      permanent: true,
      stopBatch: false,
    });
  });

  describe("a lost binding", () => {
    const handling = handleRefusal("not-bound");

    it("is NOT permanent — a re-invite as the same player rescues the backlog", () => {
      expect(handling.permanent).toBe(false);
    });

    it("stops the batch, since every other item would fail identically", () => {
      expect(handling.stopBatch).toBe(true);
    });
  });

  describe("rate limiting", () => {
    const handling = handleRefusal("rate-limited");

    it("is transient — a large backlog hitting the budget is expected", () => {
      expect(handling.permanent).toBe(false);
    });

    it("stops the batch instead of hammering a spent budget", () => {
      expect(handling.stopBatch).toBe(true);
    });
  });

  it("classifies every refusal the server can return", () => {
    // A new MatchMutationError must be classified deliberately, not fall
    // through to a default that quietly retries forever or quietly gives up.
    for (const code of ALL_REFUSALS) {
      const handling = handleRefusal(code);
      expect(typeof handling.permanent).toBe("boolean");
      expect(typeof handling.stopBatch).toBe("boolean");
    }
  });

  it("never stops the batch for a permanent, item-local refusal", () => {
    // Otherwise one stuck match at the head of the queue would block every
    // match behind it forever — the queue would never drain again.
    for (const code of ALL_REFUSALS) {
      const { permanent, stopBatch } = handleRefusal(code);
      if (permanent) expect(stopBatch).toBe(false);
    }
  });
});

describe("isPermanentRefusal", () => {
  it("is false for a match that has not been refused yet", () => {
    expect(isPermanentRefusal(undefined)).toBe(false);
  });

  it("offers Discard only where retrying is hopeless", () => {
    expect(ALL_REFUSALS.filter(isPermanentRefusal).sort()).toEqual([
      "identity-mismatch",
      "invalid",
      "not-allowed",
    ]);
  });

  it("keeps a lost binding out of the discard path", () => {
    // The subtle one: pushing the user to discard here would destroy matches
    // that a fresh invite for the same Player would have synced.
    expect(isPermanentRefusal("not-bound")).toBe(false);
  });
});
