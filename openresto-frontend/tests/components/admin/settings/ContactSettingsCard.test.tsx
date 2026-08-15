/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { ContactSettingsCard } from "@/components/admin/settings/ContactSettingsCard";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  saveBrandSettings: jest.fn(),
}));

let mockBrandData: {
  primaryColor: string;
  appName: string;
  websiteUrl?: string;
  phoneNumber?: string;
  emailAddress?: string;
} = {
  primaryColor: "#0a7ea4",
  appName: "Open Resto",
};

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrandData,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
};

/** Runs out the autosave debounce and lets the save promise settle. */
const flushAutosave = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
};

describe("ContactSettingsCard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: "Saved." },
    });
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with the Contact & Website title", () => {
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByText("Contact & Website")).toBeTruthy();
  });

  it("says nothing is set in its subtitle when both contacts are blank", () => {
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByText("No fallback contact set")).toBeTruthy();
  });

  it("summarises the configured contacts in its subtitle", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      phoneNumber: "+1 555 0100",
      emailAddress: "hi@example.com",
    };
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByText("+1 555 0100 · hi@example.com")).toBeTruthy();
  });

  it("collapses when the header is pressed", () => {
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByText("Website URL")).toBeTruthy();
    fireEvent.press(screen.getByText("Contact & Website"));
    expect(screen.queryByText("Website URL")).toBeNull();
  });

  it("renders the Website URL field", () => {
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByText("Website URL")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://bookings.example.com")).toBeTruthy();
  });

  it("pre-fills Website URL from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      websiteUrl: "https://mysite.example.com",
    };
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("https://mysite.example.com")).toBeTruthy();
  });

  it("passes websiteUrl to saveBrandSettings when set", async () => {
    render(<ContactSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText("https://bookings.example.com"),
      "https://bookings.example.com"
    );
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ websiteUrl: "https://bookings.example.com" })
    );
  });

  // An omitted field means "leave it alone" to the API, so emptying the input has to travel as
  // an explicit empty string or the stored URL survives the clear.
  it("sends an empty websiteUrl to clear a stored one", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      websiteUrl: "https://old.example.com",
    };
    render(<ContactSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByPlaceholderText("https://bookings.example.com"), "");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ websiteUrl: "" })
    );
  });

  it("syncs websiteUrl when brand context updates", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      websiteUrl: "https://v1.example.com",
    };
    const { rerender } = render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("https://v1.example.com")).toBeTruthy();
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      websiteUrl: "https://v2.example.com",
    };
    await act(async () => {
      rerender(<ContactSettingsCard {...baseProps} />);
    });
    expect(screen.getByDisplayValue("https://v2.example.com")).toBeTruthy();
  });

  it("renders the contact fields", () => {
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByText("Contact Phone")).toBeTruthy();
    expect(screen.getByText("Contact Email")).toBeTruthy();
  });

  it("pre-fills the contact fields from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      phoneNumber: "+44 20 7946 0958",
      emailAddress: "hello@example.com",
    };
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("+44 20 7946 0958")).toBeTruthy();
    expect(screen.getByDisplayValue("hello@example.com")).toBeTruthy();
  });

  it("passes trimmed contact fields to saveBrandSettings", async () => {
    render(<ContactSettingsCard {...baseProps} />);

    fireEvent.changeText(screen.getByPlaceholderText("+44 20 7946 0958"), " +1 555 0100 ");
    fireEvent.changeText(screen.getByPlaceholderText("bookings@example.com"), " hi@example.com ");
    await flushAutosave();

    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: "+1 555 0100", emailAddress: "hi@example.com" })
    );
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("sends an empty string to clear a stored contact field", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      phoneNumber: "+1 555 0100",
    };
    render(<ContactSettingsCard {...baseProps} />);

    fireEvent.changeText(screen.getByPlaceholderText("+44 20 7946 0958"), "");
    await flushAutosave();

    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: "" })
    );
  });

  // The server rejects a malformed address, so a half-typed one must not be sent at all —
  // otherwise every address in progress would flash an error on its way to being valid.
  it("holds the save until the email address is well-formed", async () => {
    render(<ContactSettingsCard {...baseProps} />);

    fireEvent.changeText(screen.getByPlaceholderText("bookings@example.com"), "hi@");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();
    expect(screen.getByText("Not saved: that isn't a valid email address yet.")).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText("bookings@example.com"), "hi@example.com");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: "hi@example.com" })
    );
  });

  it("reports an unreachable server", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue(null);
    render(<ContactSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByPlaceholderText("+44 20 7946 0958"), "+1 555 0100");
    await flushAutosave();
    expect(screen.getByText("Couldn't reach the server.")).toBeTruthy();
  });

  it("surfaces a rejected save with the server's message", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Phone number cannot exceed 32 characters.",
    });
    render(<ContactSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByPlaceholderText("+44 20 7946 0958"), "+1 555 0100");
    await flushAutosave();
    expect(screen.getByText("Phone number cannot exceed 32 characters.")).toBeTruthy();
  });
});
