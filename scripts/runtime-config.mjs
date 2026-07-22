export const MIN_ADMIN_PASSWORD_LENGTH = 20;

/**
 * Validate only configuration that must exist before a production process can
 * safely become routable. Development deliberately permits `change-me`.
 *
 * @param {Record<string, string | undefined>} env
 */
export function validateRuntimeConfig(env) {
  if (env.NODE_ENV !== "production") return;

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }

  if ((env.ADMIN_PASSWORD?.length ?? 0) < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters in production`,
    );
  }
}
