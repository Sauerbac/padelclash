// Better Auth's HTTP surface — every auth endpoint (sign-up, sign-in, verify-email,
// sign-out, OAuth callbacks) mounts under /api/auth/* (module-structure.md: Route
// Handlers carry real HTTP surfaces).
//
// The handler is resolved lazily, on the first request, so importing this module
// during `next build` (which has no env or DB) never constructs the auth instance.

import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/auth";

let handlers: ReturnType<typeof toNextJsHandler> | undefined;

function get() {
  if (!handlers) handlers = toNextJsHandler(getAuth());
  return handlers;
}

export async function GET(request: Request) {
  return get().GET(request);
}

export async function POST(request: Request) {
  return get().POST(request);
}
