/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { AuthProvider } from "@/context/AuthContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  })
) as jest.Mock;

jest.mock("expo-router", () => {
  const Link = ({ children }: any) => children;
  return {
    Link,
    usePathname: jest.fn().mockReturnValue("/dashboard"),
    useRouter: jest.fn(() => ({ replace: jest.fn(), push: jest.fn() })),
  };
});

jest.mock("@/api/auth", () => ({
  logout: jest.fn().mockResolvedValue(true),
  checkSession: jest.fn().mockResolvedValue({
    id: 1,
    email: "admin@test.com",
    displayName: "Admin Person",
    role: "Owner",
  }),
}));

jest.mock("@/api/admin", () => ({
  adminLookupBookings: jest.fn().mockResolvedValue([]),
  getAdminBooking: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

import { usePathname, useRouter } from "expo-router";
import { logout } from "@/api/auth";

describe("AdminSidebar", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/dashboard");
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn(), push: mockPush });
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        {ui}
      </SafeAreaProvider>
    );

  it("renders all navigation links", async () => {
    renderWithProviders(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("Overview")).toBeTruthy();
      expect(screen.getByText("Bookings")).toBeTruthy();
      expect(screen.getByText("Brand")).toBeTruthy();
      expect(screen.getByText("Account")).toBeTruthy();
      expect(screen.getByText("Back to site")).toBeTruthy();
    });
  });

  it("renders the lookup booking widget", async () => {
    renderWithProviders(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("Lookup Booking")).toBeTruthy();
      expect(screen.getByPlaceholderText("Email or reference…")).toBeTruthy();
    });
  });

  it("calls logout when sign out is pressed", async () => {
    renderWithProviders(
      <AuthProvider>
        <AdminSidebar />
      </AuthProvider>
    );
    const signOutBtn = await screen.findByText("Log out");
    fireEvent.press(signOutBtn);
    expect(logout).toHaveBeenCalled();
  });
});
