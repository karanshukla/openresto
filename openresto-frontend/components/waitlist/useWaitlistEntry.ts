import { useCallback, useEffect, useRef, useState } from "react";
import { getWaitlistStatus, leaveWaitlist, type WaitlistEntryStatus } from "@/api/waitlist";
import haptics from "@/utils/haptics";

/** How often a queued guest's ticket re-reads their place. The server has no push for this. */
export const WAITLIST_POLL_MS = 20_000;

/**
 * A guest's place in the walk-in queue, read by the ref they were given on joining. Polls while
 * the entry is still queued and stops once it has left, and buzzes once when the party is
 * called, since the guest is usually not looking at the screen. Leaving asks first through
 * `showLeaveConfirm`, the same in-app confirmation cancelling a booking uses.
 *
 * @see [WaitlistTicket.test.tsx](../../tests/components/waitlist/WaitlistTicket.test.tsx):
 * pins the polling stopping once the entry closes, the single buzz on being called, and leave.
 */
export function useWaitlistEntry(entryRef: string) {
  /** Undefined until the first read lands, null when the ref names no entry. */
  const [entry, setEntry] = useState<WaitlistEntryStatus | null | undefined>(undefined);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveFailed, setLeaveFailed] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const lastStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    const next = await getWaitlistStatus(entryRef);
    if (next === undefined) {
      setRefreshFailed(true);
      return;
    }
    setRefreshFailed(false);
    if (next?.status === "notified" && lastStatus.current === "waiting") {
      haptics.outcome("success");
    }
    lastStatus.current = next?.status ?? null;
    setEntry(next);
  }, [entryRef]);

  const queued = entry?.status === "waiting" || entry?.status === "notified";

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!queued) return;
    const timer = setInterval(load, WAITLIST_POLL_MS);
    return () => clearInterval(timer);
  }, [queued, load]);

  const leave = async () => {
    setLeaving(true);
    const ok = await leaveWaitlist(entryRef);
    setLeaving(false);
    setShowLeaveConfirm(false);
    setLeaveFailed(!ok);
    if (ok) await load();
  };

  return {
    entry,
    queued,
    refreshFailed,
    leaving,
    leaveFailed,
    leave,
    showLeaveConfirm,
    setShowLeaveConfirm,
  };
}

export type WaitlistEntryState = ReturnType<typeof useWaitlistEntry>;
