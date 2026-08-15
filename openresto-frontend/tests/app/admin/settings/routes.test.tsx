/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor } from "@testing-library/react-native";
import AdminSettingsIndex from "@/app/admin/settings/index";
import BrandSettingsScreen from "@/app/admin/settings/brand";
import EmailSettingsScreen from "@/app/admin/settings/email";
import AccountSettingsScreen from "@/app/admin/settings/account";
import UserSettingsScreen from "@/app/admin/settings/users";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

const mockRedirect = jest.fn();
jest.mock("expo-router", () => {
  const Screen = () => null;
  Screen.displayName = "Screen";
  const Redirect = (props: { href: string }) => {
    mockRedirect(props.href);
    const { Text } = require("react-native");
    return <Text>{`redirect:${props.href}`}</Text>;
  };
  Redirect.displayName = "Redirect";
  return { Stack: { Screen }, Redirect };
});

const stub = (name: string) => {
  const Stub = () => {
    const { Text } = require("react-native");
    return <Text>{name}</Text>;
  };
  Stub.displayName = name;
  return Stub;
};

jest.mock("@/components/admin/settings/BrandSettingsCard", () => ({
  BrandSettingsCard: stub("BrandSettingsCard"),
}));
jest.mock("@/components/admin/settings/FooterSettingsCard", () => ({
  FooterSettingsCard: stub("FooterSettingsCard"),
}));
jest.mock("@/components/admin/settings/HighlightsCard", () => ({
  HighlightsCard: stub("HighlightsCard"),
}));
jest.mock("@/components/admin/settings/HeaderImageCard", () => ({
  HeaderImageCard: stub("HeaderImageCard"),
}));
jest.mock("@/components/admin/settings/ContactSettingsCard", () => ({
  ContactSettingsCard: stub("ContactSettingsCard"),
}));
jest.mock("@/components/admin/settings/BrandPreview", () => ({
  BrandPreview: stub("BrandPreview"),
}));
jest.mock("@/components/admin/settings/EmailSettingsCard", () => ({
  EmailSettingsCard: stub("EmailSettingsCard"),
}));
jest.mock("@/components/admin/settings/EmailDeliveryPanel", () => ({
  EmailDeliveryPanel: stub("EmailDeliveryPanel"),
}));
// The email route owns the SMTP state both its halves share; the cards are stubbed, so the
// route only needs the hook to exist, not to reach the API.
jest.mock("@/hooks/use-email-settings", () => ({
  useEmailSettings: () => ({}),
}));
jest.mock("@/components/admin/settings/PushNotificationsCard", () => ({
  PushNotificationsCard: stub("PushNotificationsCard"),
}));
jest.mock("@/components/admin/settings/SecurityCard", () => ({
  SecurityCard: stub("SecurityCard"),
}));
jest.mock("@/components/admin/settings/UsersCard", () => ({
  UsersCard: stub("UsersCard"),
}));

// The Users route gates on the signed-in role, so it needs an auth context.
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

describe("admin settings routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asRole("Owner");
  });

  it("lands the bare /admin/settings path on Brand", () => {
    renderWithProviders(<AdminSettingsIndex />);
    expect(mockRedirect).toHaveBeenCalledWith("/admin/settings/brand");
  });

  it("renders the brand cards", async () => {
    renderWithProviders(<BrandSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Brand")).toBeTruthy();
      expect(screen.getByText("BrandSettingsCard")).toBeTruthy();
      expect(screen.getByText("HeaderImageCard")).toBeTruthy();
      expect(screen.getByText("ContactSettingsCard")).toBeTruthy();
      expect(screen.getByText("HighlightsCard")).toBeTruthy();
      expect(screen.getByText("FooterSettingsCard")).toBeTruthy();
      expect(screen.getByText("BrandPreview")).toBeTruthy();
    });
  });

  it("renders the notification cards", async () => {
    renderWithProviders(<EmailSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Email & Push")).toBeTruthy();
      expect(screen.getByText("EmailSettingsCard")).toBeTruthy();
      expect(screen.getByText("EmailDeliveryPanel")).toBeTruthy();
      expect(screen.getByText("PushNotificationsCard")).toBeTruthy();
    });
  });

  it("renders the account card", async () => {
    renderWithProviders(<AccountSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Account")).toBeTruthy();
      expect(screen.getByText("SecurityCard")).toBeTruthy();
    });
  });

  it("shows the users card to an Owner", async () => {
    renderWithProviders(<UserSettingsScreen />, { withAuth: true });
    await waitFor(() => expect(screen.getByText("UsersCard")).toBeTruthy());
  });

  it("redirects a Manager away from the users route", async () => {
    asRole("Manager");
    renderWithProviders(<UserSettingsScreen />, { withAuth: true });
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith("/admin/settings/account"));
    expect(screen.queryByText("UsersCard")).toBeNull();
  });
});
