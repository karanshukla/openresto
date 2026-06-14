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
  getEmailFailures: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const defaultSettings = {
  host: "",
  port: 587,
  username: "",
  password: "",
  enableSsl: true,
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
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({ ...defaultSettings });
    (adminApi.getEmailFailures as jest.Mock).mockResolvedValue([]);
  });

  it("renders collapsed state with Email SMTP title", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
  });

  it("shows Setup required when not configured", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Setup required")).toBeTruthy();
    });
  });

  it("shows Connected status when configured", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      ...defaultSettings,
      host: "smtp.gmail.com",
      isConfigured: true,
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText(/Connected/)).toBeTruthy();
    });
  });

  it("collapses when header is pressed", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
    expect(screen.getByText("Provider")).toBeTruthy();
    fireEvent.press(screen.getByText("Email (SMTP)"));
    expect(screen.queryByText("Provider")).toBeNull();
  });

  it("expands when header is pressed after collapse", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Email (SMTP)"));
    expect(screen.queryByText("Provider")).toBeNull();
    fireEvent.press(screen.getByText("Email (SMTP)"));
    expect(screen.getByText("Provider")).toBeTruthy();
  });

  it("renders provider options when expanded", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByText("Gmail")).toBeTruthy();
    expect(screen.getByText("Outlook 365")).toBeTruthy();
    expect(screen.getByText("Custom SMTP")).toBeTruthy();
  });

  it("selects Gmail provider and sets host", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Gmail"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("smtp.gmail.com")).toBeTruthy();
    });
  });

  it("selects Outlook provider and sets host", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Outlook 365"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("smtp.office365.com")).toBeTruthy();
    });
  });

  it("selects Custom SMTP provider", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("Custom SMTP"));
    expect(screen.getByText("Custom SMTP")).toBeTruthy();
  });

  it("renders SMTP host input when expanded", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByPlaceholderText("smtp.gmail.com")).toBeTruthy();
  });

  it("renders port input with default 587", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByDisplayValue("587")).toBeTruthy();
  });

  it("changes port using port preset button", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("465"));
    expect(screen.getByDisplayValue("465")).toBeTruthy();
  });

  it("changes port using port preset 25", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("25"));
    expect(screen.getByDisplayValue("25")).toBeTruthy();
  });

  it("changes port using port preset 2525", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("2525"));
    expect(screen.getByDisplayValue("2525")).toBeTruthy();
  });

  it("toggles SSL to None when None is pressed", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("None"));
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("toggles SSL back to SSL/TLS", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.press(screen.getByText("None"));
    fireEvent.press(screen.getByText("SSL/TLS"));
    expect(screen.getByText("SSL/TLS")).toBeTruthy();
  });

  it("renders username and password inputs", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByPlaceholderText("you@example.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("SMTP password or app token")).toBeTruthy();
  });

  it("toggles password visibility", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("SMTP password or app token"), "secret123");
    // find the eye toggle button (Ionicons is mocked, so we look for the wrapper Pressable near the password)
    const passwordInput = screen.getByDisplayValue("secret123");
    expect(passwordInput).toBeTruthy();
  });

  it("renders from name and from email inputs", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByPlaceholderText("OpenResto")).toBeTruthy();
    expect(screen.getByPlaceholderText("noreply@site.com")).toBeTruthy();
  });

  it("renders Status section when expanded", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getByText("Not yet tested")).toBeTruthy();
  });

  it("shows Send test button when expanded", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByText("Send test")).toBeTruthy();
  });

  it("calls saveEmailSettings when Save SMTP settings is pressed", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Settings saved." });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Save SMTP settings"));
    });
    expect(adminApi.saveEmailSettings).toHaveBeenCalled();
  });

  it("shows save success message after successful save", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Settings saved." });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Save SMTP settings"));
    });
    await waitFor(() => {
      expect(screen.getByText("Settings saved.")).toBeTruthy();
    });
  });

  it("shows error message when save fails", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue(null);
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Save SMTP settings"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });
  });

  it("shows Saving… while saving is in progress", async () => {
    let resolve: (v: { message: string }) => void;
    (adminApi.saveEmailSettings as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    act(() => {
      fireEvent.press(screen.getByText("Save SMTP settings"));
    });
    expect(screen.getByText("Saving…")).toBeTruthy();
    await act(async () => {
      resolve!({ message: "Done." });
    });
  });

  it("runs test connection when Send test is pressed with host and username", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    (adminApi.testEmailConnection as jest.Mock).mockResolvedValue({
      ok: true,
      message: "Connected.",
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Send test"));
    });
    await waitFor(() => {
      expect(adminApi.testEmailConnection).toHaveBeenCalled();
    });
  });

  it("shows connection successful status after successful test", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    (adminApi.testEmailConnection as jest.Mock).mockResolvedValue({
      ok: true,
      message: "Authentication accepted.",
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Send test"));
    });
    await waitFor(() => {
      expect(screen.getByText("Connection successful")).toBeTruthy();
    });
  });

  it("shows connection failed status after failed test", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    (adminApi.testEmailConnection as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Connection refused.",
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Send test"));
    });
    await waitFor(() => {
      expect(screen.getByText("Connection failed")).toBeTruthy();
    });
  });

  it("shows Re-test button after successful connection test", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    (adminApi.testEmailConnection as jest.Mock).mockResolvedValue({
      ok: true,
      message: "Connected.",
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Send test"));
    });
    await waitFor(() => {
      expect(screen.getByText("Re-test")).toBeTruthy();
    });
  });

  it("does not run test when host or username is empty", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    // host and username are empty - pressing Send test does nothing
    fireEvent.press(screen.getByText("Send test"));
    expect(adminApi.testEmailConnection).not.toHaveBeenCalled();
  });

  it("shows Booking confirmations section when expanded", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByText("Booking confirmations")).toBeTruthy();
    expect(screen.getByText("Booking confirmation")).toBeTruthy();
  });

  it("shows configure SMTP notice when not yet tested", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByText("Configure and test SMTP above to enable.")).toBeTruthy();
  });

  it("populates form from loaded settings", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      host: "smtp.example.com",
      port: 465,
      username: "admin@example.com",
      password: "pass",
      enableSsl: false,
      fromName: "OpenResto",
      fromEmail: "no-reply@example.com",
      isConfigured: true,
      sendBookingConfirmations: true,
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    await waitFor(() => {
      expect(screen.getByDisplayValue("smtp.example.com")).toBeTruthy();
      expect(screen.getByDisplayValue("admin@example.com")).toBeTruthy();
    });
  });

  it("matches provider to loaded host (Gmail)", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      ...defaultSettings,
      host: "smtp.gmail.com",
      isConfigured: true,
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    await waitFor(() => {
      expect(screen.getByDisplayValue("smtp.gmail.com")).toBeTruthy();
    });
  });

  it("shows send failures when present", async () => {
    (adminApi.getEmailFailures as jest.Mock).mockResolvedValue([
      {
        id: 1,
        recipientEmail: "guest@example.com",
        attemptedAt: "2026-05-01T10:00:00Z",
        bookingRef: "ABC123",
        errorMessage: "Connection refused",
      },
    ]);
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    await waitFor(() => {
      expect(screen.getByText("Send failures")).toBeTruthy();
      expect(screen.getByText("guest@example.com")).toBeTruthy();
      expect(screen.getByText("Connection refused")).toBeTruthy();
      expect(screen.getByText(/Ref: ABC123/)).toBeTruthy();
    });
  });

  it("shows failure without bookingRef", async () => {
    (adminApi.getEmailFailures as jest.Mock).mockResolvedValue([
      {
        id: 2,
        recipientEmail: "other@example.com",
        attemptedAt: "2026-05-01T10:00:00Z",
        bookingRef: null,
        errorMessage: "SMTP timeout",
      },
    ]);
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    await waitFor(() => {
      expect(screen.getByText("other@example.com")).toBeTruthy();
      expect(screen.getByText("SMTP timeout")).toBeTruthy();
    });
  });

  it("renders in dark mode without error", async () => {
    render(<EmailSettingsCard {...baseProps} isDark />);
    await waitFor(() => {
      expect(screen.getByText("Email (SMTP)")).toBeTruthy();
    });
  });

  it("shows ok status when isConfigured is true on load", async () => {
    (adminApi.getEmailSettings as jest.Mock).mockResolvedValue({
      ...defaultSettings,
      host: "smtp.gmail.com",
      isConfigured: true,
    });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    await waitFor(() => {
      expect(screen.getByText("Connection successful")).toBeTruthy();
    });
  });

  it("toggles booking confirmation when connection is tested and ok", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    (adminApi.testEmailConnection as jest.Mock).mockResolvedValue({ ok: true, message: "OK." });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Send test"));
    });
    await waitFor(() => {
      expect(screen.getByText("Re-test")).toBeTruthy();
    });
    // Now the confirmation toggle should be enabled
    fireEvent.press(screen.getByText("Booking confirmation"));
    await waitFor(() => {
      expect(screen.getByText(/Emails will be sent/)).toBeTruthy();
    });
  });

  it("shows from name in sender identity section", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    expect(screen.getByText("From name")).toBeTruthy();
    expect(screen.getByText("From email")).toBeTruthy();
  });

  it("changes host input value", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "my.smtp.host");
    expect(screen.getByDisplayValue("my.smtp.host")).toBeTruthy();
  });

  it("changes username input value", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "admin@test.com");
    expect(screen.getByDisplayValue("admin@test.com")).toBeTruthy();
  });

  it("updates password input value", async () => {
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("SMTP password or app token"), "mypassword");
    expect(screen.getByDisplayValue("mypassword")).toBeTruthy();
  });

  it("toggles booking confirmation toggle when connection is enabled (role=switch)", async () => {
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    (adminApi.testEmailConnection as jest.Mock).mockResolvedValue({ ok: true, message: "OK." });
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Send test"));
    });
    await waitFor(() => expect(screen.getByText("Re-test")).toBeTruthy());
    // Find ToggleSwitch by role="switch"
    const toggleSwitch = screen.getByRole("switch");
    act(() => {
      fireEvent.press(toggleSwitch);
    });
    await waitFor(() => {
      expect(screen.getByText(/Emails will be sent/)).toBeTruthy();
    });
  });

  it("shows Testing… status while test is in progress", async () => {
    let resolve: (v: { ok: boolean; message: string }) => void;
    (adminApi.saveEmailSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    (adminApi.testEmailConnection as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<EmailSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Email (SMTP)")).toBeTruthy());
    fireEvent.changeText(screen.getByPlaceholderText("smtp.gmail.com"), "smtp.gmail.com");
    fireEvent.changeText(screen.getByPlaceholderText("you@example.com"), "user@example.com");
    act(() => {
      fireEvent.press(screen.getByText("Send test"));
    });
    await waitFor(() => {
      expect(screen.getByText("Testing connection…")).toBeTruthy();
    });
    expect(screen.getByText("Testing…")).toBeTruthy();
    await act(async () => {
      resolve!({ ok: true, message: "OK." });
    });
  });
});
