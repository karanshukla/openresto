/**
 * @jest-environment jsdom
 */
import React from "react";
import fs from "fs";
import path from "path";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import UserLayout from "@/app/(user)/_layout";

// Populated by the Stack.Screen mock below. Named with the `mock` prefix so the
// jest.mock factory is allowed to close over it.
const mockRegisteredRoutes: string[] = [];

// The layout's offline strip takes the top safe-area inset, and the hook throws outside a
// provider — the app mounts one in app/_layout.tsx, these tests render the layout alone.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID: "stack" }, children);
  Stack.Screen = ({ name }: { name: string }) => {
    mockRegisteredRoutes.push(name);
    return null;
  };
  return {
    Stack,
    Slot: () => React.createElement(View, { testID: "slot" }),
    useRouter: () => ({ push: jest.fn() }),
    useSegments: () => ["(user)"],
  };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

jest.mock("@/components/layout/Navbar", () => () => null);
jest.mock("@/components/common/KeyboardShortcutsHelp", () => () => null);
jest.mock("@/hooks/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: jest.fn() }));

describe("(user)/_layout route registration", () => {
  it("registers only routes that exist on disk", () => {
    // Expo Router matches a <Stack.Screen name> against the route filename. A name that
    // matches nothing silently drops that screen's options — which is how
    // "booking-confirmation/[bookingId]" sat here while the route file was always
    // [bookingRef].tsx, leaving the confirmation screen without its title or its
    // suppressed back button. Renaming a route file is the moment this breaks, and
    // nothing else in the suite notices, so the check is against the filesystem
    // rather than a hardcoded list.
    const originalOS = Platform.OS;
    // The <Stack> is the native branch; on web the layout returns a <Slot> instead.
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    mockRegisteredRoutes.length = 0;

    try {
      render(<UserLayout />);
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    }

    expect(mockRegisteredRoutes.length).toBeGreaterThan(0);

    const routesDir = path.join(process.cwd(), "app", "(user)");
    const missing = mockRegisteredRoutes.filter((name) => {
      const base = path.join(routesDir, name);
      return !fs.existsSync(`${base}.tsx`) && !fs.existsSync(path.join(base, "index.tsx"));
    });

    expect(missing).toEqual([]);
  });
});
