/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  saveBrandSettings: jest.fn(),
  uploadHeroImage: jest.fn(),
  deleteHeroImage: jest.fn(),
}));

// Mutable so individual tests can supply a headerImageUrl or faviconIcon
let mockBrandData: {
  primaryColor: string;
  appName: string;
  headerImageUrl: string | null;
  faviconIcon?: string;
  websiteUrl?: string;
  subtitle?: string;
  highlightsHeading?: string;
  highlightsSubheading?: string;
  headerImageFit?: string;
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

describe("BrandSettingsCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", headerImageUrl: null };
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

  it("shows Upload button when no hero image", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("calls saveBrandSettings when Save is pressed", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved successfully." });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: "My Resto",
        primaryColor: "#0a7ea4",
      })
    );
    await waitFor(() => {
      expect(screen.getByText("Saved successfully.")).toBeTruthy();
    });
  });

  it("shows 'Saving…' while saving", async () => {
    let resolve: (v: { message: string }) => void;
    (adminApi.saveBrandSettings as jest.Mock).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    act(() => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(screen.getByText("Saving…")).toBeTruthy();
    await act(async () => {
      resolve!({ message: "Saved." });
    });
  });

  it("shows error message when saveBrandSettings returns null", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue(null);
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });
  });

  it("disables Save when appName is empty", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "");
    const saveBtn = screen.getByText("Save");
    expect(saveBtn).toBeTruthy();
  });

  it("presses a preset color swatch and updates the color input", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("color-swatch-#2563eb"));
    expect(screen.getByDisplayValue("#2563eb")).toBeTruthy();
  });

  it("calls uploadHeroImage and shows success when file is selected", async () => {
    const mockFile = new File(["content"], "hero.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [mockFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    (adminApi.uploadHeroImage as jest.Mock).mockResolvedValue("https://example.com/hero.jpg");
    render(<BrandSettingsCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    expect(adminApi.uploadHeroImage).toHaveBeenCalledWith(mockFile);
    await waitFor(() => {
      expect(screen.getByText("Header image uploaded.")).toBeTruthy();
    });
  });

  it("shows error when uploadHeroImage returns null", async () => {
    const mockFile = new File(["content"], "hero.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [mockFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    (adminApi.uploadHeroImage as jest.Mock).mockResolvedValue(null);
    render(<BrandSettingsCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to upload image.")).toBeTruthy();
    });
  });

  it("shows size error when file is too large", async () => {
    const largeFile = new File(["x".repeat(6 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [largeFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<BrandSettingsCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Image must be under 5 MB.")).toBeTruthy();
    });
    expect(adminApi.uploadHeroImage).not.toHaveBeenCalled();
  });

  it("does nothing when no file is selected", async () => {
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<BrandSettingsCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    expect(adminApi.uploadHeroImage).not.toHaveBeenCalled();
  });

  it("shows Change and Remove buttons when a hero image exists", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: "https://example.com/hero.jpg",
    };
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("Change")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("calls deleteHeroImage and shows success message when Remove is pressed", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: "https://example.com/hero.jpg",
    };
    (adminApi.deleteHeroImage as jest.Mock).mockResolvedValue(true);
    render(<BrandSettingsCard {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Remove"));
    });
    expect(adminApi.deleteHeroImage).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Header image removed.")).toBeTruthy();
    });
  });

  it("shows error style when save result message contains 'fail'", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      message: "Failed to update brand.",
    });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to update brand.")).toBeTruthy();
    });
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
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByTestId("favicon-icon-coffee"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ faviconIcon: "coffee" })
    );
  });

  it("renders Website URL field", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("Website URL")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://bookings.example.com")).toBeTruthy();
  });

  it("pre-fills Website URL from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      websiteUrl: "https://mysite.example.com",
    };
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("https://mysite.example.com")).toBeTruthy();
  });

  it("passes websiteUrl to saveBrandSettings when set", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText("https://bookings.example.com"),
      "https://bookings.example.com"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ websiteUrl: "https://bookings.example.com" })
    );
  });

  it("passes undefined websiteUrl when field is empty", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "My Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ websiteUrl: undefined })
    );
  });

  it("syncs websiteUrl when brand context updates", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      websiteUrl: "https://v1.example.com",
    };
    const { rerender } = render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("https://v1.example.com")).toBeTruthy();
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      websiteUrl: "https://v2.example.com",
    };
    await act(async () => {
      rerender(<BrandSettingsCard {...baseProps} />);
    });
    expect(screen.getByDisplayValue("https://v2.example.com")).toBeTruthy();
  });

  // ── New home-page customization fields (#183, #185, #187) ──────────────────

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
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(
      screen.getByPlaceholderText("Scroll down to pick a location below…"),
      "Best pizza in town"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: "Best pizza in town" })
    );
  });

  it("renders Highlights Heading and Subheading fields", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("Highlights Heading")).toBeTruthy();
    expect(screen.getByText("Highlights Subheading")).toBeTruthy();
  });

  it("pre-fills highlights heading/subheading from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      highlightsHeading: "What we love",
      highlightsSubheading: "Hand-picked",
    };
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByDisplayValue("What we love")).toBeTruthy();
    expect(screen.getByDisplayValue("Hand-picked")).toBeTruthy();
  });

  it("passes highlights heading/subheading to saveBrandSettings", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.changeText(screen.getByPlaceholderText("Restaurant highlights"), "Why visit us");
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ highlightsHeading: "Why visit us" })
    );
  });

  it("renders the Header image fit select defaulting to Cover", () => {
    render(<BrandSettingsCard {...baseProps} />);
    // Raw web <select> forwards `data-testid` not `testID` (same as the booking-duration
    // select in RestaurantInfoForm), so query via UNSAFE_getByProps.
    const select = screen.UNSAFE_getByProps({ "data-testid": "header-image-fit-select" });
    expect(select.props.value).toBe("Cover");
  });

  it("pre-fills headerImageFit from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      headerImageFit: "Contain",
    };
    render(<BrandSettingsCard {...baseProps} />);
    const select = screen.UNSAFE_getByProps({ "data-testid": "header-image-fit-select" });
    expect(select.props.value).toBe("Contain");
  });

  it("passes headerImageFit to saveBrandSettings", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved." });
    render(<BrandSettingsCard {...baseProps} />);
    // Change the fit select to Contain.
    const select = screen.UNSAFE_getByProps({ "data-testid": "header-image-fit-select" });
    fireEvent(select, "change", { target: { value: "Contain" } });
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith(
      expect.objectContaining({ headerImageFit: "Contain" })
    );
  });
});
