import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

const mockPush = jest.fn();

// The layout's offline strip takes the top safe-area inset, and the hook throws outside a
// provider — the app mounts one in app/_layout.tsx, these tests render the layout alone.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/services/quickActions", () => ({
  registerQuickActions: jest.fn(() => () => {}),
}));

jest.mock("expo-router", () => ({
  Slot: () => null,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/",
  useSegments: () => ["(user)"],
}));

// The tab bar's own tests pin what it asks of the platform; here only that the layout hands
// the guest routes to it off web is the question.
jest.mock("@/components/layout/GuestTabs", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="guest-tabs" /> };
});

jest.mock("@/components/layout/Navbar", () => ({
  __esModule: true,
  default: () => null,
}));

const originalOS = Platform.OS;

function renderOn(os: "ios" | "android") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  const { default: UserLayout } = require("@/app/(user)/_layout");
  return render(<UserLayout />);
}

beforeEach(() => {
  mockPush.mockClear();
  jest.mocked(require("@/services/quickActions").registerQuickActions).mockClear();
});

afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
});

/**
 * Issue #426. Off web the guest routes sit under the native tab bar, and every one of them
 * lives in one of its route groups; the layout's own job is to hand them to the bar.
 */
describe("UserLayout", () => {
  // The web branch is the navbar's and never reaches the tab bar; layout.shortcuts.test.tsx
  // renders it under jsdom, which is what its keyboard handling needs.
  it.each(["ios", "android"] as const)("mounts the native tab bar on %s", (os) => {
    renderOn(os);

    expect(screen.getByTestId("guest-tabs")).toBeTruthy();
  });
});

/**
 * Issue #431. Long-pressing the app icon is the returning guest's shortcut back to their
 * booking. Registered at runtime, not declared in the config plugin, so the label follows the
 * language the guest picked instead of the one the publisher built in.
 */
describe("UserLayout quick actions", () => {
  const { registerQuickActions } = require("@/services/quickActions");

  // The same i18n key GuestTabs gives the My booking tab, so the shortcut and the tab cannot
  // end up naming the same destination differently.
  it("offers the booking lookup under the label the tab bar uses", () => {
    renderOn("ios");

    expect(registerQuickActions).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My Bookings" })
    );
  });

  it("sends a launch from the action to the lookup screen", () => {
    renderOn("ios");

    registerQuickActions.mock.calls.at(-1)[0].onSelect();

    expect(mockPush).toHaveBeenCalledWith("/lookup");
  });
});
