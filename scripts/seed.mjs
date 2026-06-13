// Local seed data — STUB.
//
// Decided (Q5): seed a demo group, a mix of claimed and Unclaimed Players, and a
// handful of competitive matches, built on the real services write path so it
// exercises the replay engine — NOT raw inserts into the projection tables,
// which would rot the moment the rating formula changes. That write path doesn't
// exist until slice 04 (services / log-match), so this is a placeholder until then.
console.log(
  "[seed] not yet implemented — the match-logging service it builds on arrives " +
    "in slice 04. This stub keeps `npm run db:seed` wired so the setup docs are stable.",
);
process.exit(0);
