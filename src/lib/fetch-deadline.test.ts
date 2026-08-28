import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithDeadline } from "./fetch-deadline";

describe("fetchWithDeadline", () => {
  afterEach(() => vi.useRealTimers());

  it("aborts a server contact after five seconds", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );

    const response = fetchWithDeadline("/api/session", {}, 5_000, fetcher);
    const rejected = expect(response).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(5_000);

    await rejected;
  });
});
