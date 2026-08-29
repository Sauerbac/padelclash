import { POOR_CONNECTION_MS } from "../../lib/slow-connection";

export type ResilientCreateResult<T> =
  | { kind: "submitted"; result: T }
  | { kind: "refused"; result: T }
  | { kind: "queued" }
  | { kind: "not-durable" };

type CreateResult =
  | { ok: true }
  | { ok: false; code: string; error: string };

export async function submitResilientCreate<T extends CreateResult>({
  id,
  definitelyOffline,
  submit,
  enqueue,
  removeQueued,
  noteRefusal,
  onQueued,
  onLateSettled,
}: {
  id: string;
  definitelyOffline: boolean;
  submit(): Promise<T>;
  enqueue(): Promise<void>;
  removeQueued(id: string): Promise<void>;
  noteRefusal(id: string, code: Extract<T, { ok: false }>["code"], error: string): Promise<void>;
  onQueued(): void;
  onLateSettled?(result: T): void;
}): Promise<ResilientCreateResult<T>> {
  const queue = async (): Promise<ResilientCreateResult<T>> => {
    try {
      await enqueue();
      onQueued();
      return { kind: "queued" };
    } catch {
      return { kind: "not-durable" };
    }
  };

  if (definitelyOffline) {
    return queue();
  }

  const submission = submit();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<"slow">((resolve) => {
    timer = setTimeout(() => resolve("slow"), POOR_CONNECTION_MS);
  });
  const foreground = await Promise.race([
    submission.then(
      (result) => ({ kind: "response" as const, result }),
      () => ({ kind: "network-failure" as const }),
    ),
    slow,
  ]);

  if (foreground !== "slow") {
    if (timer) clearTimeout(timer);
    if (foreground.kind === "response") {
      return foreground.result.ok
        ? { kind: "submitted", result: foreground.result }
        : { kind: "refused", result: foreground.result };
    }
    return queue();
  }

  const queued = await queue();
  if (queued.kind !== "queued") return queued;

  // The form is released as soon as IndexedDB confirms durability. The late
  // request belongs to this module from here on and can only reconcile the
  // same Match id; it never reports into a later form attempt.
  void submission
    .then(async (result) => {
      if (result.ok) {
        await removeQueued(id);
      } else {
        await noteRefusal(
          id,
          result.code as Extract<T, { ok: false }>["code"],
          result.error,
        );
      }
      onLateSettled?.(result);
    })
    .catch(() => undefined);
  return queued;
}
