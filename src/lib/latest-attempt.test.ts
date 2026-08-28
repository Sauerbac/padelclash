import { describe, expect, it, vi } from "vitest";
import { createLatestAttemptGate } from "./latest-attempt";

describe("latest attempt gate", () => {
  it("suppresses a late result from a superseded navigation", () => {
    const publish = vi.fn();
    const gate = createLatestAttemptGate();
    const first = gate.start();
    const second = gate.start();

    first.publish(() => publish("first"));
    second.publish(() => publish("second"));

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith("second");
  });
});
