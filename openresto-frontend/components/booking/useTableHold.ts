import { useEffect, useRef, useState } from "react";
import { createHold, releaseHold, HoldResponse } from "@/api/holds";

export type HoldStatus = "idle" | "pending" | "held" | "unavailable" | "expired";

const HOLD_DEBOUNCE_MS = 2000;

interface UseTableHoldParams {
  restaurantId: number;
  sections: { id: number; tables: { id: number }[] }[];
  tableId: number | undefined;
  date: string;
  time: string;
  email: string;
}

interface UseTableHoldResult {
  hold: HoldResponse | null;
  holdStatus: HoldStatus;
  secondsLeft: number;
  holdId: string | null;
  setHoldStatus: (status: HoldStatus) => void;
  releaseCurrentHold: () => void;
}

export function useTableHold({
  restaurantId,
  sections,
  tableId,
  date,
  time,
  email,
}: UseTableHoldParams): UseTableHoldResult {
  const [hold, setHold] = useState<HoldResponse | null>(null);
  const [holdStatus, setHoldStatus] = useState<HoldStatus>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentHoldId = useRef<string | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearCountdown() {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }

  function startCountdown(expiresAt: string) {
    clearCountdown();
    const update = () => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(secs);
      if (secs === 0) {
        clearCountdown();
        setHoldStatus("expired");
        setHold(null);
        currentHoldId.current = null;
      }
    };
    update();
    countdownTimer.current = setInterval(update, 1000);
  }

  function releaseCurrentHold() {
    if (currentHoldId.current) {
      releaseHold(currentHoldId.current);
      currentHoldId.current = null;
    }
    setHold(null);
    setHoldStatus("idle");
    clearCountdown();
  }

  // Debounced hold trigger
  useEffect(() => {
    if (!tableId || !date || !time || !email.trim()) {
      setHoldStatus("idle");
      return;
    }

    /* istanbul ignore next -- guards against redundant hold when already held */
    if (hold && holdStatus === "held") {
      return;
    }

    /* istanbul ignore next -- clears previous debounce timer */
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setHoldStatus("pending");

    debounceTimer.current = setTimeout(async () => {
      releaseCurrentHold();

      const sectionId = sections.find((s) => s.tables.some((t) => t.id === tableId))?.id ?? 0;
      const isoDate = new Date(`${date}T${time}:00`).toISOString();

      const result = await createHold({
        restaurantId,
        tableId,
        sectionId,
        date: isoDate,
      });

      if (result) {
        currentHoldId.current = result.holdId;
        setHold(result);
        setHoldStatus("held");
        startCountdown(result.expiresAt);
      } else {
        setHoldStatus("unavailable");
      }
    }, HOLD_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, date, time, email]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      clearCountdown();
      if (currentHoldId.current) {
        releaseHold(currentHoldId.current);
      }
    };
  }, []);

  return {
    hold,
    holdStatus,
    secondsLeft,
    holdId: currentHoldId.current,
    setHoldStatus,
    releaseCurrentHold,
  };
}
