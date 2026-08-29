"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  createRefreshAttemptCoordinator,
  type RefreshAttemptPhase,
} from "@/lib/refresh-attempt";

type RefreshAttemptContextValue = {
  phase: RefreshAttemptPhase;
  begin: () => boolean;
  acknowledge: (marker: string) => void;
  subscribeToCompletion: (listener: () => void) => () => void;
};

const RefreshAttemptContext = createContext<RefreshAttemptContextValue | null>(
  null,
);

export function RefreshAttemptProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<RefreshAttemptPhase>("idle");
  const [request, setRequest] = useState(0);
  const [, setCommitPulse] = useState(0);
  const [coordinator] = useState(() =>
    createRefreshAttemptCoordinator({
      onPhaseChange: setPhase,
      onRequest: () => setRequest((current) => current + 1),
      onCommitPulse: () => setCommitPulse((current) => current + 1),
    }),
  );

  useEffect(() => {
    if (request > 0) router.refresh();
  }, [request, router]);

  useEffect(() => () => coordinator.dispose(), [coordinator]);

  const value = {
    phase,
    begin: coordinator.begin,
    acknowledge: coordinator.acknowledge,
    subscribeToCompletion: coordinator.subscribeToCompletion,
  };

  return (
    <RefreshAttemptContext.Provider value={value}>
      {children}
    </RefreshAttemptContext.Provider>
  );
}

export function useRefreshAttempt() {
  const value = useContext(RefreshAttemptContext);
  if (!value) {
    throw new Error("PullToRefresh requires RefreshAttemptProvider");
  }
  return value;
}

export function RefreshCommitMarker({ marker }: { marker: string }) {
  const { acknowledge } = useRefreshAttempt();
  useEffect(() => acknowledge(marker), [acknowledge, marker]);
  return null;
}
