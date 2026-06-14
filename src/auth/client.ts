// The browser-side auth client (Better Auth React). Imported by the client form
// components for sign-up / sign-in / sign-out and the `useSession` hook.
//
// No baseURL: same-origin, so the client targets this app's own
// /api/auth/[...all] route. Must import from "better-auth/react" (the framework
// build), not the server entry.

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
