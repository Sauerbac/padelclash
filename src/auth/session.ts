// Server-side session access. Wraps Better Auth's `getSession` with the request
// headers from `next/headers`, so route components and Server Actions read the
// current Account without re-plumbing cookies each time.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";

/** The current session, or null when no one is signed in. */
export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

/**
 * The current session, or a redirect to /login. Use to guard protected routes —
 * the redirect throws, so callers can treat the return as always-present.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
