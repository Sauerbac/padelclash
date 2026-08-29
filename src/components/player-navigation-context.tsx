"use client";

import { createContext, useContext } from "react";

const PlayerNavigationState = createContext({
  needsConnection: false,
  explanationPreview: false,
});

export function PlayerNavigationProvider({
  needsConnection,
  explanationPreview = false,
  children,
}: {
  needsConnection: boolean;
  explanationPreview?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PlayerNavigationState.Provider value={{ needsConnection, explanationPreview }}>
      {children}
    </PlayerNavigationState.Provider>
  );
}

export function usePlayerNavigationState() {
  return useContext(PlayerNavigationState);
}
