/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  saveBrandSettings: jest.fn(),
}));

// Mutable so individual tests can supply a faviconIcon or subtitle
let mockBrandData: {
  primaryColor: string;
  appName: string;
  headerImageUrl: string | null;
  faviconIcon?: string;
  subtitle?: string;
} = {
  primaryColor: "#0a7ea4",
  appName: "Open Resto",
  headerImageUrl: null,
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

describe("BrandSettingsCard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: "Saved." },
    });
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", headerImageUrl: null };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders with Brand Identity title", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("Brand Identity")).toBeTruthy();
  });

  it("shows app name and primary color in subtitle", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText(/Open Resto/)).toBeTruthy();
    expect(screen.getByText(/#0a7ea4/)).toBeTruthy();
  });

  it("shows expanded content on render", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("App Name")).toBeTruthy();
    expect(screen.getByText("Primary Color")).toBeTruthy();
  });

  it("collapses when header is pressed", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("App Name")).toBeTruthy();
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.queryByText("App Name")).toBeNull();
  });

  it("allows changing app name", () => {
    render(<BrandSettingsCard {...baseProps} />);
    const input = screen.getByDisplayValue("Open Resto");
    fireEvent.changeText(input, "My Resto");
    expect(screen.getByDisplayValue("My Resto")).toBeTruthy();
  });

  it("shows character count for app name", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("10/32")).toBeTruthy(); // "Open Resto" = 10 chars
  });

  it("selects a preset color when pressed", () => {
    render(<BrandSettingsCard {...baseProps} />);
    // Find the preset color input to verify it changes
    const colorInput = screen.getByDisplayValue("#0a7ea4");
    fireEvent.changeText(colorInput, "#2563eb");
    expect(screen.getByDisplayValue("#2563eb")).toBeTruthy();
  });

  it("autosaves the app name once editing stops, and reports it saved", async () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();

    await flushAutosave();

    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: "My Resto",
        primaryColor: "#0a7ea4",
      })
    );
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("collapses a burst of typing into a single save", async () => {
    render(<BrandSettingsCard {...baseProps} />);
    const input = screen.getByDisplayValue("Open Resto");
    fireEvent.changeText(input, "M");
    act(() => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.changeText(input, "My");
    act(() => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.changeText(input, "My Resto");

    await flushAutosave();

    expect(adminApi.saveBrandSettings).toHaveBeenCalledTimes(1);
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ appName: "My Resto" })
    );
  });

  it("shows 'Saving…' while the save is in flight", async () => {
    let resolve: (v: { ok: true; data: { message: string } }) => void;
    (adminApi.saveBrandSettings as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await flushAutosave();
    expect(screen.getByText("Saving…")).toBeTruthy();
    await act(async () => {
      resolve!({ ok: true, data: { message: "Saved." } });
    });
  });

  it("reports an unreachable server", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue(null);
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await flushAutosave();
    expect(screen.getByText("Couldn't reach the server.")).toBeTruthy();
  });

  it("retries the failed save when Retry is pressed", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValueOnce(null);
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await flushAutosave();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Retry saving"));
    });

    expect(adminApi.saveBrandSettings).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("never autosaves an empty app name, and says so", async () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();
    expect(screen.getByText("Not saved: the app name can't be empty.")).toBeTruthy();
  });

  // The colour input is typed into character by character; "#0a7" is not a colour the server
  // will accept, and a rejected save would flash an error mid-word.
  it("waits for a complete hex colour before saving", async () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("#0a7ea4"), "#16a3");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();
    expect(
      screen.getByText("Not saved: waiting for a full hex colour, like #0a7ea4.")
    ).toBeTruthy();

    fireEvent.changeText(screen.getByDisplayValue("#16a3"), "#16a34a");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ primaryColor: "#16a34a" })
    );
  });

  it("presses a preset color swatch and updates the color input", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("color-swatch-#2563eb"));
    expect(screen.getByDisplayValue("#2563eb")).toBeTruthy();
  });

  // A rejected save comes back as a message that need not contain the word "fail" — the
  // result's `ok` is what decides, and the message is shown as-is.
  it("surfaces a rejected save with the server's message", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: false,
      message: "App name cannot exceed 32 characters.",
    });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await flushAutosave();
    expect(screen.getByText("App name cannot exceed 32 characters.")).toBeTruthy();
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("shows favicon icon label in subtitle when faviconIcon is set", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      faviconIcon: "utensils",
    };
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getAllByText(/Utensils/).length).toBeGreaterThan(0);
  });

  it("pressing a favicon icon swatch selects it and shows 'tap to deselect'", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("favicon-icon-utensils"));
    expect(screen.getByText(/tap to deselect/)).toBeTruthy();
  });

  it("pressing an already-selected favicon icon deselects it", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      faviconIcon: "utensils",
    };
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText(/tap to deselect/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("favicon-icon-utensils"));
    expect(screen.queryByText(/tap to deselect/)).toBeNull();
  });

  it("passes faviconIcon to saveBrandSettings when saving", async () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("favicon-icon-coffee"));
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ faviconIcon: "coffee" })
    );
  });

  // An omitted field means "leave it alone" to the API, so a deselected icon has to travel as
  // an explicit empty string or the picker's deselect silently does nothing.
  it("sends an empty faviconIcon when the selected icon is deselected", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      faviconIcon: "utensils",
    };
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("favicon-icon-utensils"));
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ faviconIcon: "" })
    );
  });

  it("renders the Home Page Subtitle field and char counter", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("Home Page Subtitle")).toBeTruthy();
    expect(screen.getByText("0/160")).toBeTruthy();
  });

  it("pre-fills subtitle from brand context and updates it", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      subtitle: "Welcome to our table",
    };
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("Welcome to our table")).toBeTruthy();
  });

  it("passes subtitle to saveBrandSettings when set", async () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText("Scroll down to pick a location below…"),
      "Best pizza in town"
    );
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: "Best pizza in town" })
    );
  });

  // BrandContext doesn't refetch after a write, so "what the server has" has to be tracked
  // locally — otherwise every later edit would re-send the fields that already landed.
  it("doesn't re-save fields it has already written", async () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledTimes(1);

    await flushAutosave();
    expect(adminApi.saveBrandSettings).toHaveBeenCalledTimes(1);
  });

  it("flushes a pending edit when the card unmounts", async () => {
    const { unmount } = render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await act(async () => {
      unmount();
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ appName: "My Resto" })
    );
  });

  it("syncs its fields when brand context updates", async () => {
    const { rerender } = render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("Open Resto")).toBeTruthy();
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Renamed", headerImageUrl: null };
    await act(async () => {
      rerender(<BrandSettingsCard {...baseProps} />);
    });
    expect(screen.getByDisplayValue("Renamed")).toBeTruthy();
  });
});
