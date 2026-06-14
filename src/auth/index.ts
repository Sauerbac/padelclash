// Server-side auth barrel. (The browser client lives in ./client — keep it out of
// this server entry so React Server Components never pull in the client bundle.)
export { createAuth, getAuth, type Auth, type CreateAuthOptions } from "./auth";
export { getSession, requireSession } from "./session";
