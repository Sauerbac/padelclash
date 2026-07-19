"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker (public/sw.js) in production.
 * In dev it actively unregisters instead — a compose image smoke test on the
 * same port would otherwise leave a worker serving stale prod chunks into
 * `next dev`.
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {
          // Registration failure just means no offline shell — never break the app.
        });
    } else {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((reg) => reg.unregister()))
        .catch(() => {});
    }
  }, []);
  return null;
}
