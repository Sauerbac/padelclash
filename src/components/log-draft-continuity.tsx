"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { MatchParticipant } from "@/domain/match-participant";

export type MatchDraftSlots = Record<
  "a1" | "a2" | "b1" | "b2",
  MatchParticipant | null
>;

export interface PreservedMatchDraft {
  doubles: boolean;
  slots: MatchDraftSlots;
  winner: "A" | "B" | null;
  recordSets: boolean;
  sets: { a: string; b: string }[];
  playedAt: string;
  namesByPlayerId: Record<string, string>;
}

interface LogDraftContinuityValue {
  draft: PreservedMatchDraft | null;
  save(draft: PreservedMatchDraft): void;
  clear(): void;
}

const LogDraftContinuity = createContext<LogDraftContinuityValue>({
  draft: null,
  save() {},
  clear() {},
});

export function LogDraftContinuityProvider({
  children,
  pathname: pathnameOverride,
}: {
  children: React.ReactNode;
  pathname?: string;
}) {
  const currentPathname = usePathname();
  const pathname = pathnameOverride ?? currentPathname;
  const previousPathname = useRef(pathname);
  const [draft, setDraft] = useState<PreservedMatchDraft | null>(null);
  const save = useCallback((next: PreservedMatchDraft) => {
    setDraft((current) =>
      logDraftContinuityReducer(current, { type: "save", draft: next }),
    );
  }, []);
  const clear = useCallback(() => {
    setDraft((current) => logDraftContinuityReducer(current, { type: "clear" }));
  }, []);
  const value = useMemo(() => ({ draft, save, clear }), [clear, draft, save]);

  useEffect(() => {
    if (shouldClearLogDraft(previousPathname.current, pathname)) {
      setDraft((current) => logDraftContinuityReducer(current, { type: "clear" }));
    }
    previousPathname.current = pathname;
  }, [pathname]);

  return (
    <LogDraftContinuity.Provider value={value}>
      {children}
    </LogDraftContinuity.Provider>
  );
}

export function useLogDraftContinuity(): LogDraftContinuityValue {
  return useContext(LogDraftContinuity);
}

export function shouldClearLogDraft(previous: string, next: string): boolean {
  return previous !== next && !next.startsWith("/log");
}

export function logDraftContinuityReducer(
  _current: PreservedMatchDraft | null,
  action:
    | { type: "save"; draft: PreservedMatchDraft }
    | { type: "clear" },
): PreservedMatchDraft | null {
  return action.type === "save" ? action.draft : null;
}
