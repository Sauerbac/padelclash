/**
 * Next.js server-start boundary. `register` completes before the server begins
 * accepting requests, so application code cannot observe a pre-migration
 * schema or stale Rating projections.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Keep every Node-only API behind this conditional import. Next analyzes this
  // shared entry point for Edge compatibility before eliminating runtime
  // branches, so even unreachable Node APIs here produce build warnings.
  const { registerNodeServer } = await import("./instrumentation.node");
  await registerNodeServer();
}
