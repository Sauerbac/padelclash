// Migrations run once per server boot, before the first request. Next.js never
// invokes register() during `next build`, so this only ever runs against a real
// deployment target — a missing DATABASE_URL fails the boot, it is not skipped.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./services/db/migrate");
  await runMigrations();
}
