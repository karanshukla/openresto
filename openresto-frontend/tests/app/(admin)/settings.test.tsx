/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor } from "@testing-library/react-native";
import AdminSettingsScreen from "@/app/(admin)/settings";
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

describe("AdminSettingsScreen", () => {
  it("renders global settings and security sections", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeTruthy();
      expect(screen.getByText("GLOBAL SETTINGS")).toBeTruthy();
      expect(screen.getByText("ACCOUNT SECURITY")).toBeTruthy();
    });
  });

  it("shows updated subtitle", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() =>
      expect(screen.getByText("Manage brand, email, and security.")).toBeTruthy()
    );
  });
});
