"use client";

import { useSyncExternalStore } from "react";
import {
  browserPwaPresentationFacts,
  shouldShowIosBrowserGuidance,
} from "@/lib/pwa-presentation";

function subscribeToDisplayMode(onChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);
  return () => displayMode.removeEventListener("change", onChange);
}

const serverSnapshot = () => false;

export function useStandaloneDisplayMode(): boolean {
  return useSyncExternalStore(
    subscribeToDisplayMode,
    () => browserPwaPresentationFacts().standalone,
    serverSnapshot,
  );
}

export function useIosBrowserGuidance(): boolean {
  return useSyncExternalStore(
    subscribeToDisplayMode,
    () =>
      shouldShowIosBrowserGuidance(browserPwaPresentationFacts()),
    serverSnapshot,
  );
}
