import { registerQuickActions } from "@/services/quickActions";
import { MY_BOOKING_ACTION_ID } from "@/constants/quickActions";

// A browser has no app icon to long-press, so the web half is inert by design. Pinned so the
// asymmetry is answered by a test rather than re-derived.
describe("quickActions (web)", () => {
  it("registers nothing and hands back a teardown that is safe to call", () => {
    const onSelect = jest.fn();
    const teardown = registerQuickActions({ title: "My booking", onSelect });

    expect(() => teardown()).not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("names the action so both halves match on it", () => {
    expect(MY_BOOKING_ACTION_ID).toBe("my-booking");
  });
});
