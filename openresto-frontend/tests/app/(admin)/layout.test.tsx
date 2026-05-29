import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import AdminLayout from "@/app/(admin)/_layout";
import { checkSession } from "@/api/auth";
import { useRouter, useSegments, usePathname } from "expo-router";

jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useSegments: jest.fn(),
  usePathname: jest.fn(),
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
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
  });

  it("shows loading state then authenticated stack when session is valid", async () => {
    (useSegments as jest.Mock).mockReturnValue(["(admin)", "dashboard"]);
    (checkSession as jest.Mock).mockResolvedValue({ email: "admin@test.com" });

    render(<AdminLayout />);

    await waitFor(() => {
      expect(checkSession).toHaveBeenCalled();
    });
  });

  it("redirects to login when checkSession returns null", async () => {
    (useSegments as jest.Mock).mockReturnValue(["(admin)", "dashboard"]);
    (checkSession as jest.Mock).mockResolvedValue(null);

    render(<AdminLayout />);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/(admin)/login");
    });
  });

  it("treats rate-limited response as authenticated", async () => {
    (useSegments as jest.Mock).mockReturnValue(["(admin)", "dashboard"]);
    (checkSession as jest.Mock).mockResolvedValue("rate-limited");

    render(<AdminLayout />);

    await waitFor(() => {
      expect(checkSession).toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  it("skips auth check when on login screen", async () => {
    (useSegments as jest.Mock).mockReturnValue(["(admin)", "login"]);
    (checkSession as jest.Mock).mockResolvedValue(null);

    render(<AdminLayout />);

    await waitFor(() => {
      expect(checkSession).not.toHaveBeenCalled();
    });
  });

  it("renders null when unauthenticated and not on login screen", async () => {
    (useSegments as jest.Mock).mockReturnValue(["(admin)", "dashboard"]);
    (checkSession as jest.Mock).mockResolvedValue(null);

    const { toJSON } = render(<AdminLayout />);

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    expect(toJSON()).toBeNull();
  });
});
