import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { EmailDeliveryPanel } from "@/components/admin/settings/EmailDeliveryPanel";
import { useEmailSettings } from "@/hooks/use-email-settings";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  getEmailSettings: jest.fn(),
  saveEmailSettings: jest.fn(),
  testEmailConnection: jest.fn(),
  getEmailFailures: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
  isDark: false,
};

const defaultSettings = {
  host: "",
  port: 587,
  username: "",
  password: "",
  enableSsl: true,
  isConfigured: false,
  sendBookingConfirmations: false,
};

function Panel() {
  const email = useEmailSettings();
  return <EmailDeliveryPanel {...baseProps} email={email} />;
}

describe("EmailDeliveryPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({ ...defaultSettings });
    (adminApi.getEmailFailures as jest.Mock).mockResolvedValue([]);
  });

  it("summarises a clean history in its header", async () => {
    render(<Panel />);
    await waitFor(() => expect(screen.getByText("Delivery")).toBeTruthy());
    expect(screen.getByText("Connection and send history")).toBeTruthy();
  });

  it("shows the untested state and a test button", async () => {
    render(<Panel />);
    await waitFor(() => expect(screen.getByText("Not yet tested")).toBeTruthy());
    expect(screen.getByText("Send test")).toBeTruthy();
  });

  it("counts recent failures in its header and lists them", async () => {
    (adminApi.getEmailFailures as jest.Mock).mockResolvedValue([
      {
        id: 1,
        recipientEmail: "guest@example.com",
        bookingRef: "AB12CD",
        errorMessage: "550 mailbox unavailable",
        attemptedAt: "2026-08-14T10:00:00Z",
      },
    ]);
    render(<Panel />);
    await waitFor(() => expect(screen.getByText("1 recent failure")).toBeTruthy());
    expect(screen.getByText("guest@example.com")).toBeTruthy();
    expect(screen.getByText("550 mailbox unavailable")).toBeTruthy();
  });

  it("pluralises the failure count", async () => {
    (adminApi.getEmailFailures as jest.Mock).mockResolvedValue([
      {
        id: 1,
        recipientEmail: "a@example.com",
        errorMessage: "timeout",
        attemptedAt: "2026-08-14T10:00:00Z",
      },
      {
        id: 2,
        recipientEmail: "b@example.com",
        errorMessage: "timeout",
        attemptedAt: "2026-08-14T11:00:00Z",
      },
    ]);
    render(<Panel />);
    await waitFor(() => expect(screen.getByText("2 recent failures")).toBeTruthy());
  });

  it("reports a verified connection once settings load configured", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      ...defaultSettings,
      host: "smtp.gmail.com",
      username: "me@example.com",
      isConfigured: true,
    });
    render(<Panel />);
    await waitFor(() => expect(screen.getByText("Connection successful")).toBeTruthy());
  });
});
