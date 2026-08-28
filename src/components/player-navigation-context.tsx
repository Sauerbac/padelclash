"use client";

import { createContext, useContext } from "react";

const PlayerNavigationNeedsConnection = createContext(false);

export function PlayerNavigationProvider({
  needsConnection,
  children,
}: {
  needsConnection: boolean;
  children: React.ReactNode;
}) {
  return (
    <PlayerNavigationNeedsConnection.Provider value={needsConnection}>
      {children}
    </PlayerNavigationNeedsConnection.Provider>
  );
}

export function usePlayerNavigationNeedsConnection(): boolean {
  return useContext(PlayerNavigationNeedsConnection);
}
