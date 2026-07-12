// RFC 9562 UUIDv7 — 48-bit ms timestamp, then random. Generated on the CLIENT
// for match ids (spec "Match"): the id is the offline-sync idempotency key and
// the final tiebreaker of the replay's total order, so it must be time-sortable.
// Hand-rolled (~20 lines) to avoid a dependency; works in browser and Node,
// both of which expose WebCrypto as `crypto`.

/** Matches exactly the ids `uuidv7()` produces (version and variant nibbles). */
export const UUIDV7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // Big-endian 48-bit timestamp in bytes 0–5.
  for (let i = 5; i >= 0; i--) {
    bytes[i] = now % 256;
    now = Math.floor(now / 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
