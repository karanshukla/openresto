import { useEffect, useState } from "react";

const MINUTE_TICK_MS = 60_000;

/**
 * Re-renders once a minute so a clock-derived view tracks the clock. A screen a front-of-house
 * tablet is parked on all service is wrong the moment it stops moving.
 *
 * The returned counter is not a time — it exists only to invalidate memos that read the clock
 * themselves, so callers still resolve "now" through the restaurant's timezone rather than this.
 */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), MINUTE_TICK_MS);
    return () => clearInterval(id);
  }, []);

  return tick;
}
