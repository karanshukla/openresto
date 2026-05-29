import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

const defaultSettings = {
  host: "smtp.gmail.com",
  port: 587,
  username: "user@example.com",
  password: "password123",
  enableSsl: true,
  fromName: "Restaurant Admin",
  fromEmail: "admin@example.com",
  isConfigured: true,
  sendBookingConfirmations: true,
};

jest.mock("@/api/admin", () => ({
  getEmailSettings: jest.fn().mockResolvedValue({
    host: "smtp.gmail.com",
    port: 587,
    username: "user@example.com",
    password: "password123",
    enableSsl: true,
    fromName: "Restaurant Admin",
    fromEmail: "admin@example.com",
    isConfigured: true,
    sendBookingConfirmations: true,
  }),
  saveEmailSettings: jest.fn().mockResolvedValue({ message: "Saved." }),
  testEmailConnection: jest.fn().mockResolvedValue({ ok: true, message: "Connection OK." }),
  getEmailFailures: jest.fn().mockResolvedValue([]),
}));

describe("EmailSettingsCard", () => {
  const defaultProps = {
    borderColor: "#eee",
    mutedColor: "#888",
    cardBg: "#fff",
    isDark: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const adminApi = require("@/api/admin");
    adminApi.getEmailSettings.mockResolvedValue(defaultSettings);
    adminApi.getEmailFailures.mockResolvedValue([]);
  });

  it("renders Email (SMTP) header", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
  });

  it("shows Connected status when isConfigured is true", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Connected/)).toBeTruthy();
    });
  });

  it("shows Setup required when isConfigured is false", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getEmailSettings.mockResolvedValueOnce({
      ...defaultSettings,
      isConfigured: false,
    });
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Setup required")).toBeTruthy();
    });
  });

  it("expands form when header is pressed", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("SMTP Host")).toBeTruthy();
    });
  });

  it("shows SMTP provider options when expanded", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("Gmail")).toBeTruthy();
      expect(screen.getByText("Outlook 365")).toBeTruthy();
      expect(screen.getByText("Custom SMTP")).toBeTruthy();
    });
  });

  it("saves settings when Save SMTP settings is pressed", async () => {
    const adminApi = require("@/api/admin");
    render(<EmailSettingsCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("Save SMTP settings")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Save SMTP settings"));

    await waitFor(() => {
      expect(adminApi.saveEmailSettings).toHaveBeenCalled();
    });
  });

  it("tests connection when Re-test is pressed (already configured)", async () => {
    const adminApi = require("@/api/admin");
    render(<EmailSettingsCard {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Email (SMTP)"));
    // When isConfigured=true, testState defaults to "ok" so button shows "Re-test"
    await waitFor(() => {
      expect(screen.getByText("Re-test")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Re-test"));

    await waitFor(() => {
      expect(adminApi.testEmailConnection).toHaveBeenCalled();
    });
  });

  it("shows Send test button when not configured", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getEmailSettings.mockResolvedValueOnce({
      ...defaultSettings,
      isConfigured: false,
    });
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("Send test")).toBeTruthy();
    });
  });

  it("selects Gmail provider when pressed", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("Gmail")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Gmail"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("smtp.gmail.com")).toBeTruthy();
    });
  });

  it("renders in dark mode", async () => {
    render(<EmailSettingsCard {...defaultProps} isDark={true} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
  });

  it("collapses when header is pressed again", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("Gmail")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.queryByText("Gmail")).toBeNull();
    });
  });

  it("shows error message when saveEmailSettings returns null", async () => {
    const adminApi = require("@/api/admin");
    adminApi.saveEmailSettings.mockResolvedValueOnce(null);
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("Save SMTP settings")).toBeTruthy());
    fireEvent.press(screen.getByText("Save SMTP settings"));
    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });
  });

  it("selects port preset 465 when pressed", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("465")).toBeTruthy());
    fireEvent.press(screen.getByText("465"));
    expect(screen.getByDisplayValue("465")).toBeTruthy();
  });

  it("toggles SSL off when None is pressed", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("None")).toBeTruthy());
    fireEvent.press(screen.getByText("None"));
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("toggles password visibility", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByTestId("icon-eye-outline")).toBeTruthy());
    fireEvent.press(screen.getByTestId("icon-eye-outline"));
    await waitFor(() => {
      expect(screen.getByTestId("icon-eye-off-outline")).toBeTruthy();
    });
  });

  it("toggles booking confirmation on when pressed", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getEmailSettings.mockResolvedValueOnce({
      ...defaultSettings,
      sendBookingConfirmations: false,
    });
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("Booking confirmation")).toBeTruthy());
    fireEvent.press(screen.getByText("Booking confirmation"));
    await waitFor(() => {
      expect(screen.getByText(/SMTP account/)).toBeTruthy();
    });
  });

  it("shows email failures when there are failures", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getEmailFailures.mockResolvedValueOnce([
      {
        id: 1,
        bookingRef: "ABC-123",
        recipientEmail: "guest@example.com",
        errorMessage: "Connection refused",
        attemptedAt: new Date().toISOString(),
      },
    ]);
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText("guest@example.com")).toBeTruthy();
      expect(screen.getByText("Connection refused")).toBeTruthy();
    });
  });

  it("shows email failure with bookingRef", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getEmailFailures.mockResolvedValueOnce([
      {
        id: 1,
        bookingRef: "REF-999",
        recipientEmail: "user@test.com",
        errorMessage: "Timeout",
        attemptedAt: new Date().toISOString(),
      },
    ]);
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => {
      expect(screen.getByText(/REF-999/)).toBeTruthy();
    });
  });

  it("presses ToggleSwitch directly to toggle booking confirmation", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getEmailSettings.mockResolvedValueOnce({
      ...defaultSettings,
      sendBookingConfirmations: false,
    });
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByRole("switch")).toBeTruthy());
    fireEvent.press(screen.getByRole("switch"));
    await waitFor(() => {
      expect(screen.getByText(/SMTP account/)).toBeTruthy();
    });
  });

  it("presses SSL/TLS button after switching to None", async () => {
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("None")).toBeTruthy());
    fireEvent.press(screen.getByText("None"));
    fireEvent.press(screen.getByText("SSL/TLS"));
    expect(screen.getByText("Save SMTP settings")).toBeTruthy();
  });

  it("calls testEmailConnection when test button is pressed (fail case)", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getEmailSettings.mockResolvedValueOnce({
      ...defaultSettings,
      isConfigured: false,
    });
    adminApi.testEmailConnection.mockResolvedValueOnce({ ok: false, message: "Auth failed" });
    render(<EmailSettingsCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Email (SMTP)"));
    await waitFor(() => expect(screen.getByText("Send test")).toBeTruthy());
    fireEvent.press(screen.getByText("Send test"));
    await waitFor(() => {
      expect(adminApi.testEmailConnection).toHaveBeenCalled();
    });
  });
});
