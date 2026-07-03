import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { FooterSettingsCard } from "@/components/admin/settings/FooterSettingsCard";
import * as adminApi from "@/api/admin";

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

  it("disables the copyright Save button until the text changes", () => {
    render(<FooterSettingsCard {...baseProps} />);
    expect(screen.getByText("Save")).toBeTruthy();
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
    (adminApi.adminCreateSocialLink as jest.Mock).mockResolvedValue(created);
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
      const saveButtons = screen.getAllByText("Save");
      fireEvent.press(saveButtons[saveButtons.length - 1]);
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
      const saveButtons = screen.getAllByText("Save");
      fireEvent.press(saveButtons[saveButtons.length - 1]);
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
    (adminApi.adminUpdateSocialLink as jest.Mock).mockResolvedValue(updated);
    render(<FooterSettingsCard {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Instagram")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Edit Instagram"));
    await waitFor(() => expect(screen.getByDisplayValue("Instagram")).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue("Instagram"), "Instagram Official");
    await act(async () => {
      const saveButtons = screen.getAllByText("Save");
      fireEvent.press(saveButtons[saveButtons.length - 1]);
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
      const saveButtons = screen.getAllByText("Save");
      fireEvent.press(saveButtons[saveButtons.length - 1]);
    });
    expect(adminApi.adminCreateSocialLink).toHaveBeenCalled();
    expect(screen.queryByText("New Link")).toBeNull();
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
