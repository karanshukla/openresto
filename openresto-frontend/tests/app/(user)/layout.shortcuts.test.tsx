/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { act } from "react-test-renderer";
import UserLayout from "@/app/(user)/_layout";
import { useRouter, usePathname, useSegments } from "expo-router";
import { focusTarget } from "@/utils/focusRegistry";

const mockPush = jest.fn();

jest.mock("expo-router", () => {
  const { View } = require("react-native");
  const React = require("react");
  const Slot = () => React.createElement(View, { testID: "slot" });
  const Stack = ({ children }: any) => React.createElement(View, { testID: "stack" }, children);
  Stack.Screen = () => null;
  return {
    Slot,
    Stack,
    useRouter: jest.fn(),
    usePathname: jest.fn().mockReturnValue("/"),
    useSegments: jest.fn().mockReturnValue(["(user)", "lookup"]),
  };
});

jest.mock("@/components/layout/Navbar", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/layout/Footer", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/utils/focusRegistry", () => ({
  focusTarget: jest.fn(),
}));

function dispatchKeydown(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("UserLayout keyboard shortcuts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    (usePathname as jest.Mock).mockReturnValue("/");
    (useSegments as jest.Mock).mockReturnValue(["(user)", "lookup"]);
    const { Platform } = require("react-native");
    Platform.OS = "web";
  });

  it("navigates to the lookup page and focuses it on 'l'", async () => {
    render(<UserLayout />);
    dispatchKeydown("l");
    expect(mockPush).toHaveBeenCalledWith("/lookup");
    expect(focusTarget).toHaveBeenCalledWith("user-lookup");
  });

  it("toggles the help overlay on '?'", async () => {
    render(<UserLayout />);
    expect(screen.queryByTestId("keyboard-shortcuts-backdrop")).toBeNull();

    dispatchKeydown("?");
    await waitFor(() => expect(screen.getByTestId("keyboard-shortcuts-backdrop")).toBeTruthy());

    dispatchKeydown("?");
    await waitFor(() => expect(screen.queryByTestId("keyboard-shortcuts-backdrop")).toBeNull());
  });

  it("does not bind a '/' shortcut on the end-user side", async () => {
    render(<UserLayout />);
    dispatchKeydown("/");
    expect(mockPush).not.toHaveBeenCalled();
    expect(focusTarget).not.toHaveBeenCalled();
  });

  it("does not fire user shortcuts when the user route tree is mounted but the user has navigated to an admin route (issue #140 scope leak)", async () => {
    (useSegments as jest.Mock).mockReturnValue(["admin", "dashboard"]);
    render(<UserLayout />);

    dispatchKeydown("l");
    expect(mockPush).not.toHaveBeenCalled();
    expect(focusTarget).not.toHaveBeenCalled();

    dispatchKeydown("?");
    expect(screen.queryByTestId("keyboard-shortcuts-backdrop")).toBeNull();
  });

  it("resumes firing user shortcuts once segments reflect a (user) route again", async () => {
    (useSegments as jest.Mock).mockReturnValue(["admin", "dashboard"]);
    const { rerender } = render(<UserLayout />);

    dispatchKeydown("l");
    expect(mockPush).not.toHaveBeenCalled();

    (useSegments as jest.Mock).mockReturnValue(["(user)", "lookup"]);
    rerender(<UserLayout />);

    dispatchKeydown("l");
    expect(mockPush).toHaveBeenCalledWith("/lookup");
    expect(focusTarget).toHaveBeenCalledWith("user-lookup");
  });
});
