// One place for the auth-cookie security policy (binding + admin session).
export function authCookieOptions(maxAgeSeconds: number) {
  return {
    maxAge: maxAgeSeconds,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
