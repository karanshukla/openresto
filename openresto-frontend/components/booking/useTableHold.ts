import { useEffect, useRef, useState } from "react";
import { createHold, releaseHold, HoldResponse } from "@/api/holds";
import { isHoldExpired, secondsUntilExpiry } from "@/components/booking/holdCountdown";
import { isValidEmail } from "@/utils/validation";

export type HoldStatus = "idle" | "pending" | "held" | "unavailable" | "expired";

const HOLD_DEBOUNCE_MS = 2000;

export interface UseTableHoldParams {
  restaurantId: number;
  sections: { id: number; tables: { id: number }[] }[];
  tableId: number | undefined;
  date: string;
  time: string;
  email: string;
  /** When true, fire holds without a specific table ("Any section") and let the server pick. */
  autoAssign?: boolean;
  /** Required when autoAssign is true — sent so the server can pick a fitting table. */
  seats?: number;
}

export interface UseTableHoldResult {
  hold: HoldResponse | null;
  holdStatus: HoldStatus;
  holdMessage: string | null;
  secondsLeft: number;
  holdId: string | null;
  /** Table id the server resolved for an auto-assigned hold (null for explicit holds). */
  resolvedTableId: number | null;
  /** Section id the server resolved for an auto-assigned hold (null for explicit holds). */
  resolvedSectionId: number | null;
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
  autoAssign = false,
  seats,
}: UseTableHoldParams): UseTableHoldResult {
  const [hold, setHold] = useState<HoldResponse | null>(null);
  const [holdStatus, setHoldStatus] = useState<HoldStatus>("idle");
  const [holdMessage, setHoldMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [resolvedTableId, setResolvedTableId] = useState<number | null>(null);
  const [resolvedSectionId, setResolvedSectionId] = useState<number | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentHoldId = useRef<string | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const lastAppliedParams = useRef<string>("");

  function clearCountdown() {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }

  function startCountdown(expiresAt: string) {
    clearCountdown();
    const update = () => {
      const secs = secondsUntilExpiry(expiresAt);
      setSecondsLeft(secs);
      if (isHoldExpired(secs)) {
        clearCountdown();
        setHoldStatus("expired");
        setHold(null);
        currentHoldId.current = null;
        setHoldId(null);
      }
    };
    update();
    countdownTimer.current = setInterval(update, 1000);
  }

  function releaseCurrentHold() {
    if (currentHoldId.current) {
      releaseHold(currentHoldId.current);
      currentHoldId.current = null;
      setHoldId(null);
    }
    setHold(null);
    setHoldStatus("idle");
    setHoldMessage(null);
    setResolvedTableId(null);
    setResolvedSectionId(null);
    clearCountdown();
  }

  // Debounced hold trigger
  useEffect(() => {
    // Auto-assign mode fires without a tableId; explicit mode still requires one.
    const hasTableForHold = autoAssign || (!!tableId && tableId > 0);
    if (!hasTableForHold || !date || !time || !isValidEmail(email)) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      releaseCurrentHold();
      lastAppliedParams.current = "";
      return;
    }

    const paramsKey = `${restaurantId}-${autoAssign ? "auto" : tableId}-${date}-${time}-${seats ?? ""}`;
    if (hold && holdStatus === "held" && lastAppliedParams.current === paramsKey) {
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setHoldStatus("pending");

    debounceTimer.current = setTimeout(async () => {
      const previousHoldId = currentHoldId.current;
      lastAppliedParams.current = paramsKey;

      // For auto-assign, send null table/section + seats so the server picks the best table.
      // For explicit selection, resolve the section from the tableId as before.
      const sectionId = autoAssign
        ? null
        : (sections.find((s) => s.tables.some((t) => t.id === tableId))?.id ?? 0);
      // Send naive ISO string (no 'Z' or offset) so backend can interpret as restaurant-local
      const naiveIsoDate = `${date}T${time}:00`;

      const result = await createHold({
        restaurantId,
        tableId: autoAssign ? null : tableId!,
        sectionId,
        seats: autoAssign ? seats : undefined,
        date: naiveIsoDate,
        currentHoldId: previousHoldId ?? undefined,
      });

      if (result.ok) {
        // Backend atomically released previousHoldId and placed the new hold
        currentHoldId.current = result.hold.holdId;
        setHoldId(result.hold.holdId);
        setHold(result.hold);
        setHoldMessage(null);
        // For auto-assigned holds, capture the server-resolved table/section so the form
        // can submit them with the booking (the booking create then "adopts" the held table).
        setResolvedTableId(result.hold.tableId ?? null);
        setResolvedSectionId(result.hold.sectionId ?? null);
        setHoldStatus("held");
        startCountdown(result.hold.expiresAt);
      } else {
        // Hold rejected (already-held, past time, paused, closed, walk-in).
        // Release our previous hold and surface the backend's reason.
        if (previousHoldId) releaseHold(previousHoldId);
        currentHoldId.current = null;
        setHoldId(null);
        setHold(null);
        setResolvedTableId(null);
        setResolvedSectionId(null);
        clearCountdown();
        setHoldMessage(result.message);
        setHoldStatus("unavailable");
      }
    }, HOLD_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, date, time, email, autoAssign, seats]);

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
    holdMessage,
    secondsLeft,
    holdId,
    resolvedTableId,
    resolvedSectionId,
    setHoldStatus,
    releaseCurrentHold,
  };
}
