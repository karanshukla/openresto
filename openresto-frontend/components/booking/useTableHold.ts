import { useEffect, useRef, useState } from "react";
import { createHold, releaseHold, HoldResponse } from "@/api/holds";
import { isHoldExpired, secondsUntilExpiry } from "@/components/booking/holdCountdown";
import {
  cancelHoldExpiryNotice,
  scheduleHoldExpiryNotice,
  type HoldExpiryNoticeId,
} from "@/services/holdExpiryNotice";
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
  /**
   * Combinable-table group id (#272/#274). When set, the server reserves all the group's member
   * tables as one hold. Takes precedence over tableId (mutually exclusive in the UI).
   */
  tableGroupId?: number;
  /**
   * False when the selected day takes no online bookings at all (closed, or walk-in only).
   * The server would reject the hold anyway; not asking keeps the form from reporting a
   * failure for a day it has already explained is unbookable.
   */
  enabled?: boolean;
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
  /** Combinable-table group the server resolved for a group hold (null otherwise). */
  resolvedGroupId: number | null;
  setHoldStatus: (status: HoldStatus) => void;
}

/**
 * Owns the whole hold lifecycle for one booking form.
 *
 * Every param that identifies the held unit is a dependency of the effect below, so a hold never
 * outlives the selection that produced it: the params either stop being holdable (released
 * outright) or resolve to a different unit (replaced atomically, passing the old hold id so the
 * server frees it in the same call). Callers therefore never release a hold themselves — changing
 * what they pass in is the whole protocol.
 */
export function useTableHold({
  restaurantId,
  sections,
  tableId,
  date,
  time,
  email,
  autoAssign = false,
  seats,
  tableGroupId,
  enabled = true,
}: UseTableHoldParams): UseTableHoldResult {
  const [hold, setHold] = useState<HoldResponse | null>(null);
  const [holdStatus, setHoldStatus] = useState<HoldStatus>("idle");
  const [holdMessage, setHoldMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [resolvedTableId, setResolvedTableId] = useState<number | null>(null);
  const [resolvedSectionId, setResolvedSectionId] = useState<number | null>(null);
  const [resolvedGroupId, setResolvedGroupId] = useState<number | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentHoldId = useRef<string | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const noticeId = useRef<HoldExpiryNoticeId | null>(null);
  const noticeGeneration = useRef(0);

  const lastAppliedParams = useRef<string>("");

  /**
   * The three shapes a hold request comes in. A group hold names the group and lets the server
   * resolve its members; auto-assign names nothing and lets the server pick; an explicit pick
   * names the table and resolves its own section, because the caller only tracks the table id.
   */
  function holdTarget() {
    if (tableGroupId) {
      return { tableId: null, sectionId: null, tableGroupId, seats };
    }
    if (autoAssign) {
      return { tableId: null, sectionId: null, tableGroupId: undefined, seats };
    }
    return {
      tableId: tableId!,
      sectionId: sections.find((s) => s.tables.some((t) => t.id === tableId))?.id ?? 0,
      tableGroupId: undefined,
      seats: undefined,
    };
  }

  /**
   * Withdraws the pending "about to expire" warning and invalidates any schedule call still in
   * flight. The generation bump is what makes this safe against the permission prompt: that
   * prompt can outlive the hold that raised it, and without the bump its late-arriving id would
   * be adopted as the current one and warn about a table already released.
   *
   * @see [useTableHold.test.ts](../../tests/hooks/useTableHold.test.ts) — pins that a hold
   * replaced mid-prompt cancels the warning it was waiting on rather than keeping it.
   */
  function cancelExpiryNotice() {
    noticeGeneration.current += 1;
    const id = noticeId.current;
    noticeId.current = null;
    if (id) void cancelHoldExpiryNotice(id);
  }

  async function scheduleExpiryNotice(expiresAt: string) {
    cancelExpiryNotice();
    const generation = noticeGeneration.current;
    const id = await scheduleHoldExpiryNotice(expiresAt);
    if (generation !== noticeGeneration.current) {
      void cancelHoldExpiryNotice(id);
      return;
    }
    noticeId.current = id;
  }

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
        cancelExpiryNotice();
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
    setResolvedGroupId(null);
    clearCountdown();
    cancelExpiryNotice();
  }

  useEffect(() => {
    const hasHoldableUnit = autoAssign || (!!tableId && tableId > 0) || !!tableGroupId;
    if (!enabled || !hasHoldableUnit || !date || !time || !isValidEmail(email)) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      releaseCurrentHold();
      lastAppliedParams.current = "";
      return;
    }

    const paramsKey = `${restaurantId}-${tableGroupId ? `g${tableGroupId}` : autoAssign ? "auto" : tableId}-${date}-${time}-${seats ?? ""}`;
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

      // Naive ISO — no 'Z', no offset — so the server reads it as restaurant-local.
      const naiveIsoDate = `${date}T${time}:00`;

      const result = await createHold({
        restaurantId,
        ...holdTarget(),
        date: naiveIsoDate,
        currentHoldId: previousHoldId ?? undefined,
      });

      if (result.ok) {
        // The server released previousHoldId and placed this one in the same call.
        currentHoldId.current = result.hold.holdId;
        setHoldId(result.hold.holdId);
        setHold(result.hold);
        setHoldMessage(null);
        // The booking submit sends these back so the server adopts the held unit rather than
        // racing for a second one.
        setResolvedTableId(result.hold.tableId ?? null);
        setResolvedSectionId(result.hold.sectionId ?? null);
        setResolvedGroupId(result.hold.tableGroupId ?? null);
        setHoldStatus("held");
        startCountdown(result.hold.expiresAt);
        void scheduleExpiryNotice(result.hold.expiresAt);
      } else {
        if (previousHoldId) releaseHold(previousHoldId);
        currentHoldId.current = null;
        setHoldId(null);
        setHold(null);
        setResolvedTableId(null);
        setResolvedSectionId(null);
        setResolvedGroupId(null);
        clearCountdown();
        cancelExpiryNotice();
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
  }, [tableId, date, time, email, autoAssign, seats, tableGroupId, enabled]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      clearCountdown();
      // Covers every way the form goes away with a live hold: the drawer closing, the guest
      // navigating off, and the booking landing on the confirmation screen.
      cancelExpiryNotice();
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
    resolvedGroupId,
    setHoldStatus,
  };
}
