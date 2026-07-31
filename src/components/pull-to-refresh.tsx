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

export type PullIndicatorPhase = Exclude<PullPhase, "idle"> | "refreshing";

const PREVIEW_DISTANCE = 48;

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
  const [pull, setPull] = useState<PullState>(IDLE_PULL_STATE);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

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
      update(result.state);
      if (result.shouldRefresh && !pendingRef.current) {
        startTransition(() => router.refresh());
      }
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
    (isPending ? "refreshing" : pull.phase === "idle" ? null : pull.phase);
  const distance = previewPhase
    ? PREVIEW_DISTANCE
    : isPending
      ? PREVIEW_DISTANCE
      : pull.distance;
  const dragging = pull.phase !== "idle" && !previewPhase;

  return (
    <div ref={containerRef} className="relative flex flex-1 flex-col">
      <div
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-2 z-10 flex h-9 items-center justify-center gap-2 font-mono text-[11px] font-semibold tracking-[2px] uppercase transition-opacity",
          visiblePhase ? "opacity-100" : "opacity-0",
          visiblePhase === "ready" ? "text-accent" : "text-muted-foreground",
        )}
      >
        {visiblePhase === "refreshing" ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <ArrowDown
            aria-hidden
            className={cn(
              "size-4 transition-transform",
              visiblePhase === "ready" && "rotate-180",
            )}
          />
        )}
        <span>
          {visiblePhase === null
            ? ""
            : visiblePhase === "ready"
              ? "Release to refresh"
              : visiblePhase === "refreshing"
                ? "Refreshing"
                : "Pull to refresh"}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col will-change-transform",
          !dragging && "transition-transform duration-200 ease-out",
        )}
        style={{ transform: `translateY(${distance}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
