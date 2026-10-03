"use client";

import { useEffect, useRef, useState } from "react";

export function useAdTimer(durationSeconds: number) {
  const [clock, setClock] = useState({ durationSeconds, remaining: durationSeconds });
  const [isPaused, setIsPaused] = useState(false);
  const lastTick = useRef(0);
  const remaining = clock.durationSeconds === durationSeconds ? clock.remaining : durationSeconds;

  useEffect(() => {
    lastTick.current = Date.now();
    let remainingSeconds = durationSeconds;

    const onVisibilityChange = () => {
      lastTick.current = Date.now();
      setIsPaused(document.visibilityState !== "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        setIsPaused(true);
        lastTick.current = Date.now();
        return;
      }

      setIsPaused(false);
      const now = Date.now();
      const elapsed = (now - lastTick.current) / 1000;
      lastTick.current = now;
      remainingSeconds = Math.max(0, remainingSeconds - elapsed);
      setClock({ durationSeconds, remaining: remainingSeconds });
    }, 250);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [durationSeconds]);

  return {
    remainingSeconds: Math.ceil(remaining),
    progress: durationSeconds > 0 ? Math.min(1, Math.max(0, (durationSeconds - remaining) / durationSeconds)) : 0,
    isPaused,
    isComplete: remaining <= 0,
  };
}