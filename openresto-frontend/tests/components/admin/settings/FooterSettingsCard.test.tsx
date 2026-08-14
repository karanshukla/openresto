import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { FooterSettingsCard } from "@/components/admin/settings/FooterSettingsCard";
import * as adminApi from "@/api/admin";
import * as useAppThemeModule from "@/hooks/use-app-theme";
import { getThemeColors } from "@/theme/theme";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  saveBrandSettings: jest.fn(),
  adminGetSocialLinks: jest.fn(),
  adminCreateSocialLink: jest.fn(),
  adminUpdateSocialLink: jest.fn(),
  adminDeleteSocialLink: jest.fn(),
}));

let mockBrandData: {
  primaryColor: string;
  appName: string;
  copyrightText?: string;
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
  usePersistedState: (_key: string, _defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(true); // always start expanded for these tests
  },
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
};

const mockLinks = [
  {
    id: 1,
    label: "Instagram",
    url: "https://instagram.com/resto",
    iconKey: "logo-instagram",
    sortOrder: 0,
  },
  {
    id: 2,
    label: "Yelp",
    url: "https://yelp.com/biz/resto",
    iconKey: "star-outline",
    sortOrder: 1,
  },
];

describe("FooterSettingsCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto" };
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue([]);
  });

  it("renders with Footer title", () => {
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("Footer")).toBeTruthy();
  });

  it("shows expanded content on render", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("Copyright Text")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Social Links")).toBeTruthy());
  });

  it("collapses when header is pressed", () => {
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("Copyright Text")).toBeTruthy();
    fireEvent.press(screen.getByText("Footer"));
    expect(screen.queryByText("Copyright Text")).toBeNull();
  });

  it("shows a count of configured social links in the subtitle", async () => {
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue(mockLinks);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("2 social links configured")).toBeTruthy());
  });

  it("autosaves copyright text once editing stops", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: "Brand settings saved." },
    });
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      "© 2026 My Resto"
    );
    await waitFor(
      () =>
        expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
          expect.objectContaining({ copyrightText: "© 2026 My Resto" })
        ),
      { timeout: 2000 }
    );
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  });

  it("leaves the copyright field alone until it changes", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Copyright Text")).toBeTruthy());
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(adminApi.saveBrandSettings).not.toHaveBeenCalled();
  });

  it("shows error message when saveBrandSettings returns null", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue(null);
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      "© 2026"
    );
    await waitFor(() => expect(screen.getByText("Couldn't reach the server.")).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it("syncs copyright text when brand context updates", async () => {
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

  it("shows empty state when no social links", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText(/No links yet/)).toBeTruthy());
  });

  it("shows social links list when loaded", async () => {
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue(mockLinks);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Instagram")).toBeTruthy();
      expect(screen.getByText("Yelp")).toBeTruthy();
    });
  });

  it("opens new link form when Add is pressed", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy();
    });
  });

  it("cancels new form when Cancel is pressed", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() => expect(screen.getByText("Cancel")).toBeTruthy());
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeNull();
    });
  });

  it("calls adminCreateSocialLink when Save is pressed with label and url", async () => {
    const created = {
      id: 3,
      label: "Facebook",
      url: "https://facebook.com/resto",
      iconKey: "link-outline",
      sortOrder: 0,
    };
    (adminApi.adminCreateSocialLink as jest.Mock).mockResolvedValue({ ok: true, data: created });
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy()
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF"), "Facebook");
    fireEvent.changeText(
      screen.getByPlaceholderText("https://instagram.com/yourresto"),
      "https://facebook.com/resto"
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add this link"));
    });
    expect(adminApi.adminCreateSocialLink).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Facebook", url: "https://facebook.com/resto" })
    );
  });

  it("does not call adminCreateSocialLink when label or url is empty", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy()
    );
    // Only fill the label — url stays empty
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF"), "Facebook");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add this link"));
    });
    expect(adminApi.adminCreateSocialLink).not.toHaveBeenCalled();
  });

  it("calls adminDeleteSocialLink when delete button is pressed", async () => {
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue([mockLinks[0]]);
    (adminApi.adminDeleteSocialLink as jest.Mock).mockResolvedValue(true);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Delete Instagram"));
    });
    expect(adminApi.adminDeleteSocialLink).toHaveBeenCalledWith(1);
  });

  it("opens edit form when pencil is pressed on existing link", async () => {
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue([mockLinks[0]]);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Edit Instagram"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Instagram")).toBeTruthy();
    });
  });

  it("calls adminUpdateSocialLink when saving an edited link", async () => {
    const updated = { ...mockLinks[0], label: "Instagram Official" };
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue([mockLinks[0]]);
    (adminApi.adminUpdateSocialLink as jest.Mock).mockResolvedValue({ ok: true, data: updated });
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Edit Instagram"));
    await waitFor(() => expect(screen.getByDisplayValue("Instagram")).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue("Instagram"), "Instagram Official");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save this link"));
    });
    expect(adminApi.adminUpdateSocialLink).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ label: "Instagram Official" })
    );
  });

  it("does not add to list when adminCreateSocialLink returns null", async () => {
    (adminApi.adminCreateSocialLink as jest.Mock).mockResolvedValue(null);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy()
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF"), "New Link");
    fireEvent.changeText(
      screen.getByPlaceholderText("https://instagram.com/yourresto"),
      "https://example.com"
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add this link"));
    });
    expect(adminApi.adminCreateSocialLink).toHaveBeenCalled();
    expect(screen.queryByText("New Link")).toBeNull();
  });

  it("shows an inline error and keeps the form open when create fails", async () => {
    (adminApi.adminCreateSocialLink as jest.Mock).mockResolvedValue({
      ok: false,
      message: "Social link URL must be a valid absolute URL (http, https, mailto, tel, or sms).",
    });
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy()
    );
    // A valid-looking URL so the client pre-flight passes and the server-side rejection is hit.
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF"), "Bad");
    fireEvent.changeText(
      screen.getByPlaceholderText("https://instagram.com/yourresto"),
      "https://valid-url.example.com"
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add this link"));
    });
    await waitFor(() => expect(screen.getByText(/valid absolute URL/)).toBeTruthy());
    // Form stays open so the admin can fix the field.
    expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy();
  });

  it("blocks save with an inline error on an obviously invalid URL (client pre-flight)", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy()
    );
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF"), "Oops");
    fireEvent.changeText(
      screen.getByPlaceholderText("https://instagram.com/yourresto"),
      "javascript:alert(1)"
    );
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Add this link"));
    });
    await waitFor(() => expect(screen.getByText(/valid URL/)).toBeTruthy());
    // Pre-flight means the API was never called.
    expect(adminApi.adminCreateSocialLink).not.toHaveBeenCalled();
  });

  it("applies dark-theme surface styling to the expanded form", async () => {
    const spy = jest.spyOn(useAppThemeModule, "useAppTheme").mockReturnValue({
      colors: getThemeColors(true),
      isDark: true,
      brand: mockBrandData,
      primaryColor: "#0a7ea4",
    } as ReturnType<typeof useAppThemeModule.useAppTheme>);
    try {
      render(<FooterSettingsCard {...baseProps} />);
      expect(screen.getByText("Copyright Text")).toBeTruthy();
      await waitFor(() => expect(screen.getByText("Social Links")).toBeTruthy());
    } finally {
      spy.mockRestore();
    }
  });

  it("turns the copyright counter red past the 200-character limit", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    const longText = "a".repeat(205);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      longText
    );
    await waitFor(() => expect(screen.getByText("205/200")).toBeTruthy());
  });

  it("reports 'Saving…' while the copyright save is in flight", async () => {
    let resolveSave: (value: { ok: true; data: { message: string } }) => void = () => {};
    (adminApi.saveBrandSettings as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    render(<FooterSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(`© ${new Date().getFullYear()} Open Resto. All rights reserved.`),
      "© 2026 In Flight"
    );
    await waitFor(() => expect(screen.getByText("Saving…")).toBeTruthy(), { timeout: 2000 });
    await act(async () => {
      resolveSave({ ok: true, data: { message: "Brand settings saved." } });
    });
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  });

  it("keeps other links untouched when editing one of several succeeds", async () => {
    const updated = { ...mockLinks[0], label: "Instagram Official" };
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue(mockLinks);
    (adminApi.adminUpdateSocialLink as jest.Mock).mockResolvedValue({ ok: true, data: updated });
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Edit Instagram"));
    await waitFor(() => expect(screen.getByDisplayValue("Instagram")).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue("Instagram"), "Instagram Official");
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save this link"));
    });
    await waitFor(() => expect(screen.getByText("Instagram Official")).toBeTruthy());
    expect(screen.getByText("Yelp")).toBeTruthy();
  });

  it("shows an inline error and keeps the form open when updating a link fails", async () => {
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue([mockLinks[0]]);
    (adminApi.adminUpdateSocialLink as jest.Mock).mockResolvedValue({
      ok: false,
      message: "That URL is already in use.",
    });
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Edit Instagram"));
    await waitFor(() => expect(screen.getByDisplayValue("Instagram")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save this link"));
    });
    await waitFor(() => expect(screen.getByText("That URL is already in use.")).toBeTruthy());
    expect(screen.getByDisplayValue("Instagram")).toBeTruthy();
  });

  it("shows a generic network error when updating a link returns null", async () => {
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue([mockLinks[0]]);
    (adminApi.adminUpdateSocialLink as jest.Mock).mockResolvedValue(null);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Edit Instagram"));
    await waitFor(() => expect(screen.getByDisplayValue("Instagram")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Save this link"));
    });
    await waitFor(() =>
      expect(screen.getByText("Couldn't reach the server. Please try again.")).toBeTruthy()
    );
  });

  it("keeps a link visible when deleting it fails", async () => {
    (adminApi.adminGetSocialLinks as jest.Mock).mockResolvedValue([mockLinks[0]]);
    (adminApi.adminDeleteSocialLink as jest.Mock).mockResolvedValue(false);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Delete Instagram"));
    });
    expect(adminApi.adminDeleteSocialLink).toHaveBeenCalledWith(1);
    expect(screen.getByText("Instagram")).toBeTruthy();
  });

  it("changes icon when an icon option is pressed", async () => {
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Add")).toBeTruthy());
    fireEvent.press(screen.getByText("Add"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy()
    );
    const accessible = screen.UNSAFE_getAllByProps({ accessible: true });
    fireEvent.press(accessible[accessible.length - 1]);
    expect(screen.getByPlaceholderText("e.g. Instagram, Yelp, Menu PDF")).toBeTruthy();
  });
});
