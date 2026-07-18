/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { act } from "react-test-renderer";
import AdminLayout from "@/app/admin/_layout";
import { checkSession } from "@/api/auth";
import { useRouter, usePathname, useSegments } from "expo-router";
import { focusTarget } from "@/utils/focusRegistry";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ width: 1024, height: 768 }),
}));

jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
}));

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
    usePathname: jest.fn().mockReturnValue("/admin/dashboard"),
    useSegments: jest.fn().mockReturnValue(["admin", "dashboard"]),
  };
});

jest.mock("@/components/layout/AdminSidebar", () => {
  const { View } = require("react-native");
  const React = require("react");
  return () => React.createElement(View, { testID: "sidebar" });
});

jest.mock("@/utils/focusRegistry", () => ({
  focusTarget: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

function dispatchKeydown(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("AdminLayout keyboard shortcuts", () => {
  const mockRouter = { push: jest.fn(), replace: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (usePathname as jest.Mock).mockReturnValue("/admin/dashboard");
    (useSegments as jest.Mock).mockReturnValue(["admin", "dashboard"]);
    const { Platform } = require("react-native");
    Platform.OS = "web";
  });

  async function renderAuthenticated() {
    (checkSession as jest.Mock).mockResolvedValue({ user: "admin" });
    render(<AdminLayout />);
    await waitFor(() => expect(screen.getByTestId("sidebar")).toBeTruthy());
  }

  it("navigates to dashboard on g then d", async () => {
    await renderAuthenticated();
    dispatchKeydown("g");
    dispatchKeydown("d");
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("navigates to bookings on g then b", async () => {
    await renderAuthenticated();
    dispatchKeydown("g");
    dispatchKeydown("b");
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/bookings");
  });

  it("navigates to locations on g then l", async () => {
    await renderAuthenticated();
    dispatchKeydown("g");
    dispatchKeydown("l");
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/locations");
  });

  it("navigates to settings on g then s", async () => {
    await renderAuthenticated();
    dispatchKeydown("g");
    dispatchKeydown("s");
    expect(mockRouter.push).toHaveBeenCalledWith("/admin/settings");
  });

  it("focuses the sidebar lookup input on '/'", async () => {
    await renderAuthenticated();
    dispatchKeydown("/");
    expect(focusTarget).toHaveBeenCalledWith("admin-lookup");
  });

  it("navigates to bookings with create=1 on 'c'", async () => {
    await renderAuthenticated();
    dispatchKeydown("c");
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/admin/bookings",
      params: { create: "1" },
    });
  });

  it("toggles the help overlay on '?'", async () => {
    await renderAuthenticated();
    expect(screen.queryByTestId("keyboard-shortcuts-backdrop")).toBeNull();

    dispatchKeydown("?");
    await waitFor(() => expect(screen.getByTestId("keyboard-shortcuts-backdrop")).toBeTruthy());

    dispatchKeydown("?");
    await waitFor(() => expect(screen.queryByTestId("keyboard-shortcuts-backdrop")).toBeNull());
  });

  it("does not wire nav shortcuts on the login screen", async () => {
    (usePathname as jest.Mock).mockReturnValue("/admin/login");
    (checkSession as jest.Mock).mockResolvedValue(null);
    render(<AdminLayout />);
    await waitFor(() => expect(screen.getByTestId("slot")).toBeTruthy());

    dispatchKeydown("g");
    dispatchKeydown("d");

    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("does not fire admin shortcuts when the admin route tree is mounted but the user has navigated to a (user) route (issue #140 scope leak)", async () => {
    (useSegments as jest.Mock).mockReturnValue(["(user)", "lookup"]);
    await renderAuthenticated();

    dispatchKeydown("g");
    dispatchKeydown("d");
    dispatchKeydown("c");
    dispatchKeydown("/");

    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(focusTarget).not.toHaveBeenCalled();
  });

  it("resumes firing admin shortcuts once segments reflect an admin route again", async () => {
    (useSegments as jest.Mock).mockReturnValue(["(user)", "lookup"]);
    (checkSession as jest.Mock).mockResolvedValue({ user: "admin" });
    const { rerender } = render(<AdminLayout />);
    await waitFor(() => expect(screen.getByTestId("sidebar")).toBeTruthy());

    dispatchKeydown("c");
    expect(mockRouter.push).not.toHaveBeenCalled();

    (useSegments as jest.Mock).mockReturnValue(["admin", "dashboard"]);
    rerender(<AdminLayout />);

    dispatchKeydown("c");
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/admin/bookings",
      params: { create: "1" },
    });
  });
});
