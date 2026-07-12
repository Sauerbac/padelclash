// localStorage half of the device binding (client-only). Backs up the cookie:
// if iOS evicts cookies for a rarely-opened PWA, the stored personal token
// lets us silently re-bind on next open (see BindingRecovery).

const STORAGE_KEY = "padelclash.binding";

export function readBindingToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeBindingToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Storage full or blocked — the cookie alone still works.
  }
}

export function clearBindingToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
