/**
 * Identifies the app's one home-screen quick action (#431). It lives here rather than beside
 * either half of `services/quickActions` because a `.native` module's import of its own
 * platform-neutral sibling resolves back to itself: only types survive that round trip, so a
 * value both halves need has to sit outside the split.
 */
export const MY_BOOKING_ACTION_ID = "my-booking";
