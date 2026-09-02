/** Handle for a scheduled warning, passed back to cancel it. */
export type HoldExpiryNoticeId = string;

/**
 * Warns a guest whose table hold is about to lapse while they are somewhere else — checking a
 * calendar, answering a message — rather than letting them come back to a released table.
 *
 * This file is the **web** implementation, and it is deliberately inert: a backgrounded tab
 * cannot run the timer, and a foregrounded one already shows the countdown in
 * `HoldStatusBanner`. Native resolves the sibling `holdExpiryNotice.native.ts` through Metro's
 * platform extensions, which keeps expo-notifications out of the web bundle.
 *
 * @see [holdExpiryNotice.test.ts](../tests/services/holdExpiryNotice.test.ts) — pins that web
 * schedules nothing and that cancelling is safe.
 */
export async function scheduleHoldExpiryNotice(
  _expiresAt: string
): Promise<HoldExpiryNoticeId | null> {
  return null;
}

export async function cancelHoldExpiryNotice(_id: HoldExpiryNoticeId | null): Promise<void> {}
