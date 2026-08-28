"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSlowConnectionClock } from "@/lib/slow-connection";

export type WriteWait = "normal" | "slow" | "uncertain";

export function useProlongedWrite() {
  const [writeWait, setWriteWait] = useState<WriteWait>("normal");
  const clockRef = useRef<ReturnType<typeof createSlowConnectionClock> | null>(null);

  const finish = useCallback(() => {
    clockRef.current?.dispose();
    clockRef.current = null;
    setWriteWait("normal");
  }, []);

  const begin = useCallback(() => {
    clockRef.current?.dispose();
    setWriteWait("normal");
    const clock = createSlowConnectionClock({
      onSlow: () => setWriteWait("slow"),
      onUncertain: () => setWriteWait("uncertain"),
    });
    clockRef.current = clock;
    clock.start();
  }, []);

  useEffect(() => () => clockRef.current?.dispose(), []);

  return { writeWait, begin, finish };
}
