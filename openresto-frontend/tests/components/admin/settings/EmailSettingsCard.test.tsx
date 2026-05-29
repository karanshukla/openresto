import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  getEmailSettings: jest.fn(),
  saveEmailSettings: jest.fn(),
  testEmailConnection: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockSettings = {
  host: "",
  port: 587,
  username: "",
  password: "",
  enableSsl: true,
  fromName: null,
  fromEmail: null,
  isConfigured: false,
  sendBookingConfirmations: false,
};

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
  isDark: false,
};

describe("EmailSettingsCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue(mockSettings);
  });

  it("renders Email (SMTP) header", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
  });

  it("shows Setup required subtitle when not configured", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Setup required")).toBeTruthy();
    });
  });

  it("is collapsed by default (no Provider label visible)", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.queryByText("Gmail")).toBeNull();
  });

  it("expands when header is pressed", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("Gmail")).toBeTruthy();
      expect(screen.getByText("Outlook 365")).toBeTruthy();
      expect(screen.getByText("Custom SMTP")).toBeTruthy();
    });
  });

  it("shows SMTP Host input after expanding", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("smtp.gmail.com")).toBeTruthy();
    });
  });

  it("shows Save SMTP settings button after expanding", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("Save SMTP settings")).toBeTruthy();
    });
  });

  it("shows connected host in subtitle when configured", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      ...mockSettings,
      host: "smtp.gmail.com",
      username: "user@example.com",
      isConfigured: true,
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Connected · smtp.gmail.com")).toBeTruthy();
    });
  });

  it("shows save success message after saving", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      ...mockSettings,
      host: "smtp.gmail.com",
      username: "user@example.com",
    });
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({
      message: "Settings saved.",
      ok: true,
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("Save SMTP settings")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save SMTP settings"));
    });
    await waitFor(() => {
      expect(screen.getByText("Settings saved.")).toBeTruthy();
    });
  });

  it("shows Failed to save on save error", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      ...mockSettings,
      host: "smtp.gmail.com",
      username: "user@example.com",
    });
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue(null);
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("Save SMTP settings")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save SMTP settings"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });
  });
});
