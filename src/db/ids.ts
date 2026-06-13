// App-generated identifiers for domain rows.
//
// Domain ids are UUIDv7 (schema.ts convention): random like v4, but with a
// 48-bit Unix-millis prefix so ids are *time-ordered*. That ordering is a quiet
// ally of the replay model — the stream sorts by (played-at, logged-at, id), and
// a v7 id breaks the final tie in creation order rather than at random
// (ADR-0001). Generation reads the clock, so it lives here in db/ (the
// persistence layer), never in the pure domain core.

import { randomBytes } from "node:crypto";

/** A fresh UUIDv7 string (RFC 9562 layout). */
export function newId(): string {
  const bytes = randomBytes(16);

  // 48-bit big-endian millisecond timestamp in bytes 0..5.
  const ts = Date.now();
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;

  // Version (7) in the high nibble of byte 6; variant (10xx) in byte 8.
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
