import { Slot } from "expo-router";

/**
 * The web half of the split. `app/(user)/_layout.tsx` never renders this on web — the navbar is
 * the way between the guest screens there — but the module still has to resolve, and resolving
 * to the native file would pull `NativeTabs`' web implementation (Radix and a stylesheet) into a
 * bundle that never mounts it. Passing the routes straight through is the one honest thing this
 * can do if it is ever reached.
 *
 * @see [GuestTabs.web.test.tsx](../../tests/components/layout/GuestTabs.web.test.tsx) — pins
 * that the routes go straight through and no tab bar is drawn.
 */
export default function GuestTabs() {
  return <Slot />;
}
