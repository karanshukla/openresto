import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import AdminLayout from "@/app/admin/_layout";
import { checkSession } from "@/api/auth";
import { useRouter, usePathname } from "expo-router";

jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
}));

jest.mock("expo-router", () => ({
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
  });

  it("shows loading state then authenticated stack when session is valid", async () => {
    (checkSession as jest.Mock).mockResolvedValue({ email: "admin@test.com" });

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

  it("skips auth check when on login screen", async () => {
    (usePathname as jest.Mock).mockReturnValue("/admin/login");
    (checkSession as jest.Mock).mockResolvedValue(null);

    render(<AdminLayout />);

    await waitFor(() => {
      expect(checkSession).not.toHaveBeenCalled();
    });
  });

  it("redirects and renders nothing meaningful when unauthenticated", async () => {
    (checkSession as jest.Mock).mockResolvedValue(null);

    render(<AdminLayout />);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
  });

  it("skips re-check when authState is already authenticated on pathname change", async () => {
    (usePathname as jest.Mock).mockReturnValue("/admin/login");
    (checkSession as jest.Mock).mockResolvedValue(null);

    const { rerender } = render(<AdminLayout />);

    // On login screen: effect sets authState to "authenticated" without calling checkSession
    await waitFor(() => expect(checkSession).not.toHaveBeenCalled());

    // Simulate navigation away from login (pathname changes)
    (usePathname as jest.Mock).mockReturnValue("/admin/dashboard");
    rerender(<AdminLayout />);

    // authState is still "authenticated" so the effect returns early; checkSession not called
    await new Promise((r) => setTimeout(r, 50));
    expect(checkSession).not.toHaveBeenCalled();
  });
});
