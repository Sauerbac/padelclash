/**
 * Tiny class-name joiner. Falsy entries are dropped. Kept local so the `ui`
 * layer stays dependency-free (module-structure.md).
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
