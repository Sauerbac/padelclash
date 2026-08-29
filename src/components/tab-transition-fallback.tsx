"use client";

import { useLinkStatus } from "next/link";
export function TabTransitionFallback() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-1 inline-block size-1.5 rounded-full bg-current transition-opacity ${pending ? "animate-pulse opacity-50" : "opacity-0"}`}
    />
  );
}
