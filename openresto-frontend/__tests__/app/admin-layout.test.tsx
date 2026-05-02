/**
 * @jest-environment jsdom
 */
import React from "react";

// Mock react-native early
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Platform.OS = "web";
  return {
    ...rn,
    useWindowDimensions: jest.fn().mockReturnValue({ width: 1024, height: 768 }),
  };
});

import { render, screen, waitFor } from "@testing-library/react-native";
import { useWindowDimensions } from "react-native";
import AdminLayout from "@/app/(admin)/_layout";
import { checkSession } from "@/api/auth";
import { useRouter, useSegments } from "expo-router";

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
    useSegments: jest.fn(),
    usePathname: jest.fn().mockReturnValue("/dashboard"),
  };
});

jest.mock("@/components/layout/AdminSidebar", () => {
  const { View } = require("react-native");
  const React = require("react");
  return () => React.createElement(View, { testID: "sidebar" });
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

describe("AdminLayout", () => {
  const mockRouter = {
    replace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSegments as jest.Mock).mockReturnValue(["dashboard"]);
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    const { Platform } = require("react-native");
    Platform.OS = "web";
  });

  it("renders loading state initially", async () => {
    (checkSession as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<AdminLayout />);
    expect(screen.getByTestId("loading-screen")).toBeTruthy();
  });

  it("redirects to login if unauthenticated", async () => {
    (checkSession as jest.Mock).mockResolvedValue(null);
    render(<AdminLayout />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/(admin)/login"));
  });

  it("renders slot if authenticated and on web", async () => {
    (checkSession as jest.Mock).mockResolvedValue({ user: "admin" });
    render(<AdminLayout />);
    await waitFor(() => expect(screen.getByTestId("sidebar")).toBeTruthy());
    expect(screen.getByTestId("slot")).toBeTruthy();
  });

  it("renders stack if authenticated and on native", async () => {
    const { Platform } = require("react-native");
    Platform.OS = "ios";
    (checkSession as jest.Mock).mockResolvedValue({ user: "admin" });
    render(<AdminLayout />);
    await waitFor(() => expect(screen.getByTestId("stack")).toBeTruthy());
  });

  it("renders login screen without gate", async () => {
    (useSegments as jest.Mock).mockReturnValue(["login"]);
    (checkSession as jest.Mock).mockResolvedValue(null);
    render(<AdminLayout />);
    await waitFor(() => expect(screen.getByTestId("slot")).toBeTruthy());
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("renders desktop wall on narrow web screens", async () => {
    (checkSession as jest.Mock).mockResolvedValue({ user: "admin" });
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 800, height: 600 });
    render(<AdminLayout />);
    await waitFor(() => expect(screen.getByText("Desktop only")).toBeTruthy());
  });
});
