/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor } from "@testing-library/react-native";
import AdminSettingsScreen from "@/app/admin/settings";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

jest.mock("@/components/admin/settings/BrandSettingsCard", () => ({
  BrandSettingsCard: () => null,
}));
jest.mock("@/components/admin/settings/EmailSettingsCard", () => ({
  EmailSettingsCard: () => null,
}));
jest.mock("@/components/admin/settings/SecurityCard", () => ({ SecurityCard: () => null }));
jest.mock("@/components/admin/settings/HighlightsCard", () => ({ HighlightsCard: () => null }));
jest.mock("@/components/admin/settings/FooterSettingsCard", () => ({
  FooterSettingsCard: () => null,
}));
jest.mock("@/components/admin/settings/PushNotificationsCard", () => ({
  PushNotificationsCard: () => null,
}));
jest.mock("@/components/admin/settings/UsersCard", () => ({
  UsersCard: () => {
    const { Text } = require("react-native");
    return <Text>UsersCard</Text>;
  },
}));

// The screen gates the Users card on the signed-in role, so it needs an auth context.
jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
  logout: jest.fn(),
}));

const asRole = (role: string) =>
  (require("@/api/auth").checkSession as jest.Mock).mockResolvedValue({
    id: 1,
    email: "admin@test.com",
    displayName: null,
    role,
  });

describe("AdminSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asRole("Owner");
  });

  it("renders global settings and security sections", async () => {
    renderWithProviders(<AdminSettingsScreen />, { withAuth: true });
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeTruthy();
      expect(screen.getByText("GLOBAL SETTINGS")).toBeTruthy();
      expect(screen.getByText("ACCOUNT SECURITY")).toBeTruthy();
    });
  });

  it("shows updated subtitle", async () => {
    renderWithProviders(<AdminSettingsScreen />, { withAuth: true });
    await waitFor(() =>
      expect(screen.getByText("Manage brand, email, and security.")).toBeTruthy()
    );
  });

  it("shows the Users card to an Owner", async () => {
    renderWithProviders(<AdminSettingsScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("UsersCard")).toBeTruthy());
  });

  it("hides the Users card from a Manager", async () => {
    asRole("Manager");
    renderWithProviders(<AdminSettingsScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("ACCOUNT SECURITY")).toBeTruthy());
    expect(screen.queryByText("UsersCard")).toBeNull();
  });
});
