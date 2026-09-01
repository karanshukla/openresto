/**
 * @jest-environment jsdom
 *
 * The native guest chrome: the header control that opens language + appearance (the web build
 * reaches both through the navbar's overflow menu, which does not render off web) and the
 * offline strip above the navigator.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useOnline } from "@/hooks/use-online";

Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });

// The layout's offline strip takes the top safe-area inset, and the hook throws outside a
// provider — the app mounts one in app/_layout.tsx, these tests render the layout alone.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children, screenOptions }: any) =>
    React.createElement(View, { testID: "stack" }, screenOptions?.headerRight?.(), children);
  Stack.Screen = () => null;
  return {
    Stack,
    Slot: () => null,
    useRouter: () => ({ push: jest.fn() }),
    useSegments: () => ["(user)"],
  };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Open Resto", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", input: "#f5f5f5", card: "#fff", border: "#ccc", surfaceAlt: "#eee" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

jest.mock("@/hooks/useKeyboardShortcuts", () => ({ useKeyboardShortcuts: jest.fn() }));
jest.mock("@/components/layout/Navbar", () => () => null);
jest.mock("@/components/common/KeyboardShortcutsHelp", () => () => null);
jest.mock("@/hooks/use-online", () => ({ useOnline: jest.fn(() => true) }));

import UserLayout from "@/app/(user)/_layout";

const mockUseOnline = useOnline as jest.MockedFunction<typeof useOnline>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseOnline.mockReturnValue(true);
});

describe("(user)/_layout on a device", () => {
  it("puts a settings control in the header, closed to begin with", () => {
    render(<UserLayout />);

    expect(screen.getByLabelText("Open settings")).toBeTruthy();
    expect(screen.queryByTestId("theme-radiogroup")).toBeNull();
  });

  it("opens language and appearance from that control, and closes again", () => {
    render(<UserLayout />);

    fireEvent.press(screen.getByLabelText("Open settings"));

    expect(screen.getByTestId("language-radiogroup")).toBeTruthy();
    expect(screen.getByTestId("theme-radiogroup")).toBeTruthy();

    fireEvent.press(screen.getByTestId("guest-settings-close"));

    expect(screen.queryByTestId("theme-radiogroup")).toBeNull();
  });

  it("shows no offline strip while the device is connected", () => {
    render(<UserLayout />);

    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("shows the offline strip above the navigator when it is not", () => {
    mockUseOnline.mockReturnValue(false);

    render(<UserLayout />);

    expect(screen.getByTestId("offline-banner")).toBeTruthy();
  });
});
