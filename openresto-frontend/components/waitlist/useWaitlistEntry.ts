import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getWaitlistStatus, leaveWaitlist, type WaitlistEntryStatus } from "@/api/waitlist";
import { confirm } from "@/utils/confirm";
import haptics from "@/utils/haptics";

/** How often a queued guest's ticket re-reads their place. The server has no push for this. */
export const WAITLIST_POLL_MS = 20_000;

/**
 * A guest's place in the walk-in queue, read by the ref they were given on joining. Polls while
 * the entry is still queued and stops once it has left, and buzzes once when the party is
 * called, since the guest is usually not looking at the screen.
 *
 * @see [WaitlistStatusScreen.test.tsx](../../tests/components/waitlist/WaitlistStatusScreen.test.tsx):
 * pins the polling stopping once the entry closes, the single buzz on being called, and leave.
 */
export function useWaitlistEntry(entryRef: string) {
  const { t } = useTranslation();
  /** Undefined until the first read lands, null when the ref names no entry. */
  const [entry, setEntry] = useState<WaitlistEntryStatus | null | undefined>(undefined);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveFailed, setLeaveFailed] = useState(false);
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
    if (!(await confirm(t("booking.waitlistStatus.leave")))) return;
    setLeaving(true);
    const ok = await leaveWaitlist(entryRef);
    setLeaving(false);
    setLeaveFailed(!ok);
    if (ok) await load();
  };

  return { entry, queued, refreshFailed, leaving, leaveFailed, leave };
}

export type WaitlistEntryState = ReturnType<typeof useWaitlistEntry>;
