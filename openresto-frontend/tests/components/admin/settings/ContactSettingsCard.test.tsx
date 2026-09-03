/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Text } from "react-native";
import { ContactSettingsCard } from "@/components/admin/settings/ContactSettingsCard";
import { BrandDraftProvider, useBrandDraft } from "@/components/admin/settings/BrandDraftContext";
import * as adminApi from "@/api/admin";
import { TextEncoder, TextDecoder } from "util";

// Under jsdom, Expo's `URL` polyfill wants TextEncoder, which jsdom lacks; without it the
// card's URL pre-flight would read every address as malformed and withhold every save.
global.TextEncoder = TextEncoder as unknown as typeof global.TextEncoder;
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;

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
  privacyPolicyUrl?: string;
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

  // The server holds both URL fields to an absolute http(s) address, so the card withholds a
  // half-typed one the same way it withholds a half-typed email — one rule, both sides.
  it.each([
    ["https://bookings.example.com", "bookings.example"],
    ["https://example.com/privacy", "example.com/priv"],
  ])("holds the save until the URL in %s is well-formed", async (placeholder, partial) => {
    render(<ContactSettingsCard {...baseProps} />);

    fireEvent.changeText(screen.getByPlaceholderText(placeholder), partial);
    await flushAutosave();
    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();
    expect(
      screen.getByText("Not saved: that isn't a full web address yet, like https://example.com.")
    ).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText(placeholder), `https://${partial}`);
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalled();
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

  it("renders the Privacy Policy URL field", () => {
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByText("Privacy Policy URL")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://example.com/privacy")).toBeTruthy();
  });

  it("pre-fills the privacy policy URL from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      privacyPolicyUrl: "https://example.com/privacy",
    };
    render(<ContactSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("https://example.com/privacy")).toBeTruthy();
  });

  it("saves a trimmed privacy policy URL", async () => {
    render(<ContactSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText("https://example.com/privacy"),
      " https://example.com/privacy "
    );
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ privacyPolicyUrl: "https://example.com/privacy" })
    );
  });

  it("sends an empty privacyPolicyUrl to clear a stored one", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      privacyPolicyUrl: "https://old.example.com/privacy",
    };
    render(<ContactSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByPlaceholderText("https://example.com/privacy"), "");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ privacyPolicyUrl: "" })
    );
  });

  // The brand preview renders from the draft, not from the saved record, so a field that only
  // reached saveBrandSettings would not show up until a reload.
  it("publishes the privacy policy URL to the draft before it is saved", async () => {
    function Probe() {
      return <Text testID="draft">{useBrandDraft().privacyPolicyUrl || "-"}</Text>;
    }
    render(
      <BrandDraftProvider>
        <ContactSettingsCard {...baseProps} />
        <Probe />
      </BrandDraftProvider>
    );

    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText("https://example.com/privacy"),
        "https://example.com/privacy"
      );
    });

    expect(screen.getByTestId("draft").props.children).toBe("https://example.com/privacy");
  });

  // Undo works on committed state: without a way to move the inputs back, the old values would
  // go to the server while the form kept showing the new ones.
  it("puts every field back when the save is undone", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      websiteUrl: "https://old.example.com",
      phoneNumber: "+1 555 0100",
      emailAddress: "old@example.com",
      privacyPolicyUrl: "https://old.example.com/privacy",
    };
    render(<ContactSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByPlaceholderText("+44 20 7946 0958"), "+1 555 0199");
    await flushAutosave();

    await act(async () => {
      fireEvent.press(screen.getByText("Undo"));
    });

    expect(screen.getByDisplayValue("+1 555 0100")).toBeTruthy();
    expect(screen.getByDisplayValue("https://old.example.com/privacy")).toBeTruthy();
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
