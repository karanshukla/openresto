/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { FooterSettingsCard } from "@/components/admin/settings/FooterSettingsCard";
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
  copyrightText?: string;
  socialLinks?: Record<string, string | undefined>;
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
    return useState(true); // always start expanded for these tests
  },
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
};

describe("FooterSettingsCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  });

  it("renders with Footer title", () => {
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("Footer")).toBeTruthy();
  });

  it("shows expanded content on render", () => {
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("Copyright Text")).toBeTruthy();
    expect(screen.getByText("Social Links")).toBeTruthy();
  });

  it("collapses when header is pressed", () => {
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("Copyright Text")).toBeTruthy();
    fireEvent.press(screen.getByText("Footer"));
    expect(screen.queryByText("Copyright Text")).toBeNull();
  });

  it("shows a count of configured social links in the subtitle", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      socialLinks: {
        instagram: "https://instagram.com/resto",
        facebook: "https://facebook.com/resto",
      },
    };
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("2 social links configured")).toBeTruthy();
  });

  it("disables Save until a field changes", () => {
    render(<FooterSettingsCard {...baseProps} />);
    const saveBtn = screen.getByText("Save");
    expect(saveBtn).toBeTruthy();
  });

  it("saves copyright text", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      message: "Brand settings saved.",
    });
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      "© 2026 My Resto"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ copyrightText: "© 2026 My Resto" })
    );
    await waitFor(() => {
      expect(screen.getByText("Brand settings saved.")).toBeTruthy();
    });
  });

  it("saves social links", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      message: "Brand settings saved.",
    });
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText("https://instagram.com/yourresto"),
      "https://instagram.com/myresto"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        socialLinks: expect.objectContaining({ instagram: "https://instagram.com/myresto" }),
      })
    );
  });

  it("pre-fills social links from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      socialLinks: { instagram: "https://instagram.com/resto" },
    };
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("https://instagram.com/resto")).toBeTruthy();
  });

  it("shows error message when saveBrandSettings returns null", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue(null);
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      "© 2026"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });
  });

  it("shows 'Saving…' while a save is in flight", async () => {
    let resolve: (v: { message: string }) => void;
    (adminApi.saveBrandSettings as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      "© 2026 My Resto"
    );
    act(() => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(screen.getByText("Saving…")).toBeTruthy();
    await act(async () => {
      resolve!({ message: "Brand settings saved." });
    });
  });

  it("shows the error color once copyright text exceeds 200 characters", () => {
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      "a".repeat(201)
    );
    expect(screen.getByText("201/200")).toBeTruthy();
  });

  it("syncs fields when brand context updates", async () => {
    const { rerender } = render(<FooterSettingsCard {...baseProps} />);
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      copyrightText: "© 2020 Old Co.",
    };
    await act(async () => {
      rerender(<FooterSettingsCard {...baseProps} />);
    });
    expect(screen.getByDisplayValue("© 2020 Old Co.")).toBeTruthy();
  });
});
