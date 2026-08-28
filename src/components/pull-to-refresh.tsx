"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  beginPull,
  finishPull,
  IDLE_PULL_STATE,
  movePull,
  type PullPhase,
  type PullState,
} from "@/lib/pull-to-refresh";
import { cn } from "@/lib/utils";
import { createSlowConnectionClock } from "@/lib/slow-connection";

export type PullIndicatorPhase = Exclude<PullPhase, "idle"> | "refreshing" | "poor-connection";

const RESTING_REFRESH_DISTANCE = 64;
const PULL_REVEAL_START_DISTANCE = 18;
const PULL_REVEAL_FADE_DISTANCE = 24;

export function PullToRefresh({
  children,
  previewPhase,
}: {
  children: React.ReactNode;
  /** Pins a documented indicator state in the fixture-only gallery. */
  previewPhase?: PullIndicatorPhase;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<PullState>(IDLE_PULL_STATE);
  const pendingRef = useRef(false);
  const sawPendingRef = useRef(false);
  const [pull, setPull] = useState<PullState>(IDLE_PULL_STATE);
  const [refreshCommitted, setRefreshCommitted] = useState(false);
  const [refreshSlow, setRefreshSlow] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isRefreshing = refreshCommitted || isPending;

  useEffect(() => {
    pendingRef.current = isRefreshing;

    if (isPending) {
      sawPendingRef.current = true;
      return;
    }

    if (!refreshCommitted || !sawPendingRef.current) return;

    sawPendingRef.current = false;
    pendingRef.current = false;
    stateRef.current = IDLE_PULL_STATE;
    setPull(IDLE_PULL_STATE);
    setRefreshCommitted(false);
  }, [isPending, isRefreshing, refreshCommitted]);

  useEffect(() => {
    if (!isRefreshing) return;
    const clock = createSlowConnectionClock({ onSlow: () => setRefreshSlow(true) });
    clock.start();
    return () => {
      clock.dispose();
      setRefreshSlow(false);
    };
  }, [isRefreshing]);

  useEffect(() => {
    const container = containerRef.current;
    const scrollRoot = document.getElementById("scroll-root");
    if (!container || !scrollRoot || previewPhase) return;

    const update = (next: PullState) => {
      stateRef.current = next;
      setPull(next);
    };
    const reset = () => update(IDLE_PULL_STATE);

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || pendingRef.current) return;
      update(
        beginPull(
          { x: event.touches[0].clientX, y: event.touches[0].clientY },
          scrollRoot.scrollTop <= 0,
        ),
      );
    };

    const onTouchMove = (event: TouchEvent) => {
      const current = stateRef.current;
      if (current.start === null || event.touches.length !== 1) return;

      const next = movePull(current, {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      });
      if (next.start !== null && next.distance > 0 && scrollRoot.scrollTop <= 0) {
        event.preventDefault();
      }
      update(next);
    };

    const onTouchEnd = () => {
      const result = finishPull(stateRef.current);
      if (result.shouldRefresh && !pendingRef.current) {
        const refreshingState: PullState = {
          phase: "ready",
          start: null,
          distance: RESTING_REFRESH_DISTANCE,
        };
        pendingRef.current = true;
        update(refreshingState);
        setRefreshCommitted(true);
        startTransition(() => router.refresh());
        return;
      }

      update(result.state);
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", reset);

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", reset);
    };
  }, [previewPhase, router]);

  const visiblePhase: PullIndicatorPhase | null =
    previewPhase ??
    (isRefreshing
      ? refreshSlow ? "poor-connection" : "refreshing"
      : pull.phase === "idle"
        ? null
        : pull.phase);
  const distance = previewPhase
    ? RESTING_REFRESH_DISTANCE
    : isRefreshing
      ? RESTING_REFRESH_DISTANCE
      : pull.distance;
  const dragging = pull.start !== null && !previewPhase;
  const revealProgress = previewPhase
    ? 1
    : visiblePhase === "pulling"
      ? Math.min(
          Math.max(distance - PULL_REVEAL_START_DISTANCE, 0) /
            PULL_REVEAL_FADE_DISTANCE,
          1,
        )
      : visiblePhase
        ? 1
        : 0;
  const label =
    visiblePhase === "ready"
      ? "Release to refresh"
      : visiblePhase === "poor-connection"
        ? "Connection is poor"
        : visiblePhase === "refreshing"
        ? "Refreshing"
        : visiblePhase === "pulling"
          ? "Pull to refresh"
          : "";
  const arrowsVisible =
    visiblePhase === "pulling" || visiblePhase === "ready";

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-col">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-3 z-10 flex h-10 items-center justify-center font-mono text-[11px] font-semibold tracking-[2px] uppercase transition-[opacity,transform] duration-300 ease-out",
          visiblePhase === "ready" ? "text-accent" : "text-muted-foreground",
        )}
        style={{
          opacity: revealProgress,
          transform: `translateY(${(1 - revealProgress) * 6}px)`,
        }}
      >
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {visiblePhase === "pulling" && revealProgress === 0 ? "" : label}
        </span>
        <div
          aria-hidden
          className="grid w-[min(17rem,calc(100%-2rem))] grid-cols-[1rem_1fr_1rem] items-center gap-2"
        >
          {(["col-start-1", "col-start-3"] as const).map((column) => (
            <ArrowDown
              key={column}
              className={cn(
                column,
                "row-start-1 size-4 transition-[opacity,rotate] duration-300 ease-out",
                arrowsVisible ? "opacity-100" : "opacity-0",
                visiblePhase === "ready" && "rotate-180",
              )}
            />
          ))}
          <span
            className={cn(
              "col-start-2 row-start-1 text-center transition-[opacity,transform] duration-300 ease-out",
              visiblePhase === "pulling"
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0",
            )}
          >
            Pull to refresh
          </span>
          <span
            className={cn(
              "col-start-2 row-start-1 text-center transition-[opacity,transform] duration-300 ease-out",
              visiblePhase === "ready"
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0",
            )}
          >
            Release to refresh
          </span>
          <span
            className={cn(
              "col-span-3 col-start-1 row-start-1 flex items-center justify-center gap-2 text-center transition-[opacity,transform] duration-300 ease-out",
              visiblePhase === "refreshing" || visiblePhase === "poor-connection"
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0",
            )}
          >
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            {visiblePhase === "poor-connection" ? "Connection is poor" : "Refreshing"}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col will-change-transform",
          !dragging &&
            "transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{ transform: `translateY(${distance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
