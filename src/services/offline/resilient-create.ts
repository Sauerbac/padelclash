import { POOR_CONNECTION_MS } from "../../lib/slow-connection";

export type ResilientCreateResult<T> =
  | { kind: "submitted"; result: T }
  | { kind: "refused"; result: T }
  | { kind: "queued" };

export async function submitResilientCreate<T extends { ok: boolean }>({
  id,
  definitelyOffline,
  submit,
  enqueue,
  removeQueued,
  onQueued,
}: {
  id: string;
  definitelyOffline: boolean;
  submit(): Promise<T>;
  enqueue(): Promise<void>;
  removeQueued(id: string): Promise<void>;
  onQueued(): void;
}): Promise<ResilientCreateResult<T>> {
  let queuePromise: Promise<void> | null = null;
  const queue = () => {
    if (!queuePromise) {
      queuePromise = enqueue().then(() => onQueued());
    }
    return queuePromise;
  };

  if (definitelyOffline) {
    await queue();
    return { kind: "queued" };
  }

  const timer = setTimeout(() => void queue(), POOR_CONNECTION_MS);
  try {
    const result = await submit();
    clearTimeout(timer);
    if (result.ok) {
      if (queuePromise) {
        await queuePromise;
        await removeQueued(id);
      }
      return { kind: "submitted", result };
    }
    if (queuePromise) {
      await queuePromise;
      return { kind: "queued" };
    }
    return { kind: "refused", result };
  } catch {
    clearTimeout(timer);
    await queue();
    return { kind: "queued" };
  }
}
