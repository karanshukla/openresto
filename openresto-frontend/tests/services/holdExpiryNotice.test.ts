import { scheduleHoldExpiryNotice, cancelHoldExpiryNotice } from "@/services/holdExpiryNotice";

// The web half is inert by design — see the module's own doc comment. Pinned so a later
// "why is nothing scheduled on web?" is answered by a test rather than by re-deriving it.
describe("holdExpiryNotice (web)", () => {
  it("schedules nothing, however long the hold has left", async () => {
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    await expect(scheduleHoldExpiryNotice(expiresAt)).resolves.toBeNull();
  });

  it("cancels without an id to cancel", async () => {
    await expect(cancelHoldExpiryNotice(null)).resolves.toBeUndefined();
  });
});
