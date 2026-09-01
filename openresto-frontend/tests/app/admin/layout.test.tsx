/**
 * @jest-environment jsdom
 *
 * The admin is web-only — AdminLayout redirects off native — so this file runs the web
 * environment its DOM side-effects (document.title) need.
 */
import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import AdminLayout from "@/app/admin/_layout";
import { checkSession } from "@/api/auth";
import { useRouter, usePathname } from "expo-router";

jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSegments: jest.fn().mockReturnValue(["admin", "dashboard"]),
  Slot: () => null,
  Stack: Object.assign(() => null, {
    Screen: jest.fn(() => null),
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/components/layout/AdminSidebar", () => () => null);
jest.mock("@/components/common/PageLoader", () => () => null);

describe("AdminLayout", () => {
  const mockRouter = { replace: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (usePathname as jest.Mock).mockReturnValue("/admin/dashboard");
    // The admin only mounts on web — AdminLayout redirects off native before any of this
    // runs. See tests/app/admin-layout.test.tsx for that boundary.
    const { Platform } = require("react-native");
    Platform.OS = "web";
  });

  it("shows loading state then authenticated stack when session is valid", async () => {
    (checkSession as jest.Mock).mockResolvedValue({
      id: 1,
      email: "admin@test.com",
      displayName: null,
      role: "Owner",
    });

    render(<AdminLayout />);

    await waitFor(() => {
      expect(checkSession).toHaveBeenCalled();
    });
  });

  it("redirects to login when checkSession returns null", async () => {
    (checkSession as jest.Mock).mockResolvedValue(null);

    render(<AdminLayout />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/admin/login");
    });
  });

  it("treats rate-limited response as authenticated", async () => {
    (checkSession as jest.Mock).mockResolvedValue("rate-limited");

    render(<AdminLayout />);

    await waitFor(() => {
      expect(checkSession).toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  it("does not bounce off the login screen when there is no session", async () => {
    // AuthProvider resolves the session on mount now — including on the login screen, where
    // the answer is "nobody". What matters is that the layout does not then redirect the
    // user to the page they are already on.
    (usePathname as jest.Mock).mockReturnValue("/admin/login");
    (checkSession as jest.Mock).mockResolvedValue(null);

    render(<AdminLayout />);

    await waitFor(() => expect(checkSession).toHaveBeenCalled());
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("redirects and renders nothing meaningful when unauthenticated", async () => {
    (checkSession as jest.Mock).mockResolvedValue(null);

    render(<AdminLayout />);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
  });

  it("resolves the session once, not once per navigation", async () => {
    (usePathname as jest.Mock).mockReturnValue("/admin/dashboard");
    (checkSession as jest.Mock).mockResolvedValue({
      id: 1,
      email: "admin@test.com",
      displayName: null,
      role: "Owner",
    });

    const { rerender } = render(<AdminLayout />);
    await waitFor(() => expect(checkSession).toHaveBeenCalledTimes(1));

    (usePathname as jest.Mock).mockReturnValue("/admin/settings");
    rerender(<AdminLayout />);

    await new Promise((r) => setTimeout(r, 50));
    expect(checkSession).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
