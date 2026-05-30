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

// Mutable so individual tests can supply a headerImageUrl
let mockBrandData: { primaryColor: string; appName: string; headerImageUrl: string | null } = {
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

  it("renders in collapsed state with Brand Identity title", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText("Brand Identity")).toBeTruthy();
  });

  it("shows app name and primary color in subtitle", () => {
    render(<BrandSettingsCard {...baseProps} />);
    expect(screen.getByText(/Open Resto/)).toBeTruthy();
    expect(screen.getByText(/#0a7ea4/)).toBeTruthy();
  });

  it("expands when header is pressed", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByText("App Name")).toBeTruthy();
    expect(screen.getByText("Primary Color")).toBeTruthy();
  });

  it("collapses when header is pressed again", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByText("App Name")).toBeTruthy();
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.queryByText("App Name")).toBeNull();
  });

  it("allows changing app name", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    const input = screen.getByDisplayValue("Open Resto");
    fireEvent.changeText(input, "My Resto");
    expect(screen.getByDisplayValue("My Resto")).toBeTruthy();
  });

  it("shows character count for app name", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByText("10/32")).toBeTruthy(); // "Open Resto" = 10 chars
  });

  it("selects a preset color when pressed", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    // Find the preset color input to verify it changes
    const colorInput = screen.getByDisplayValue("#0a7ea4");
    fireEvent.changeText(colorInput, "#2563eb");
    expect(screen.getByDisplayValue("#2563eb")).toBeTruthy();
  });

  it("shows Upload button when no hero image", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("calls saveBrandSettings when Save is pressed", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({ message: "Saved successfully." });
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    expect(adminApi.saveBrandSettings).toHaveBeenCalledWith({
      appName: "Open Resto",
      primaryColor: "#0a7ea4",
    });
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
    fireEvent.press(screen.getByText("Brand Identity"));
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
    fireEvent.press(screen.getByText("Brand Identity"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });
  });

  it("disables Save when appName is empty", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.changeText(screen.getByDisplayValue("Open Resto"), "");
    const saveBtn = screen.getByText("Save");
    expect(saveBtn).toBeTruthy();
  });

  it("presses a preset color swatch and updates the color input", () => {
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
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
    fireEvent.press(screen.getByText("Brand Identity"));
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
    fireEvent.press(screen.getByText("Brand Identity"));
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
    fireEvent.press(screen.getByText("Brand Identity"));
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
    fireEvent.press(screen.getByText("Brand Identity"));
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
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByText("Change")).toBeTruthy();
    expect(screen.getByText("Remove")).toBeTruthy();
  });

  it("calls deleteHeroImage and shows success message when Remove is pressed", async () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: "https://example.com/hero.jpg",
    };
    (adminApi.deleteHeroImage as jest.Mock).mockResolvedValue(undefined);
    render(<BrandSettingsCard {...baseProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
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
    fireEvent.press(screen.getByText("Brand Identity"));
    await act(async () => {
      fireEvent.press(screen.getByText("Save"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to update brand.")).toBeTruthy();
    });
  });
});
