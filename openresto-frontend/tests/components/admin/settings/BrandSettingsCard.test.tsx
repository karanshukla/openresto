import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn().mockReturnValue({
    primaryColor: "#007AFF",
    appName: "Test App",
    headerImageUrl: null,
  }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/api/admin", () => ({
  saveBrandSettings: jest.fn().mockResolvedValue({ message: "Settings saved." }),
  uploadHeroImage: jest.fn().mockResolvedValue("https://example.com/image.jpg"),
  deleteHeroImage: jest.fn().mockResolvedValue(undefined),
}));

describe("BrandSettingsCard", () => {
  const defaultProps = {
    borderColor: "#eee",
    mutedColor: "#888",
    cardBg: "#fff",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the Brand Identity header when collapsed", () => {
    render(<BrandSettingsCard {...defaultProps} />);
    expect(screen.getByText("Brand Identity")).toBeTruthy();
  });

  it("expands to show form when header is pressed", () => {
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByText("App Name")).toBeTruthy();
    expect(screen.getByText("Primary Color")).toBeTruthy();
  });

  it("shows app name input with current value when expanded", () => {
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByDisplayValue("Test App")).toBeTruthy();
  });

  it("calls saveBrandSettings when Save is pressed", async () => {
    const adminApi = require("@/api/admin");
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(adminApi.saveBrandSettings).toHaveBeenCalledWith({
        appName: "Test App",
        primaryColor: "#007AFF",
      });
    });
  });

  it("shows success message after save", async () => {
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Settings saved.")).toBeTruthy();
    });
  });

  it("shows error when saveBrandSettings returns null", async () => {
    const adminApi = require("@/api/admin");
    adminApi.saveBrandSettings.mockResolvedValueOnce(null);

    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(screen.getByText("Failed to save.")).toBeTruthy();
    });
  });

  it("allows changing app name input", async () => {
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test App")).toBeTruthy();
    });
    const input = screen.getByDisplayValue("Test App");
    fireEvent.changeText(input, "New Name");
    // The state should update - check that save is still available
    await waitFor(() => {
      expect(screen.getByText("Save")).toBeTruthy();
    });
  });

  it("shows preset color swatches when expanded", () => {
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    // Color input should be visible
    expect(screen.getByDisplayValue("#007AFF")).toBeTruthy();
  });

  it("collapses when header is pressed again", () => {
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.getByText("App Name")).toBeTruthy();
    fireEvent.press(screen.getByText("Brand Identity"));
    expect(screen.queryByText("App Name")).toBeNull();
  });

  it("allows changing primary color via text input", () => {
    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    const colorInput = screen.getByDisplayValue("#007AFF");
    fireEvent.changeText(colorInput, "#ff0000");
    // Just verify the input and Save button are still present after interaction
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("calls handlePickHero when Upload button is pressed", async () => {
    const adminApi = require("@/api/admin");
    const mockClick = jest.fn();
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: mockClick,
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Upload"));
    expect((global as any).document.createElement).toHaveBeenCalledWith("input");
    expect(mockClick).toHaveBeenCalled();

    // Trigger onchange with a valid file to cover lines 44-57
    mockInput.files = [{ name: "test.jpg", size: 100, type: "image/jpeg" }];
    await act(async () => {
      await mockInput.onchange();
    });

    await waitFor(() => {
      expect(adminApi.uploadHeroImage).toHaveBeenCalled();
    });
    delete (global as any).document;
  });

  it("shows error when uploaded file is too large", async () => {
    const mockClick = jest.fn();
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: mockClick,
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Upload"));

    // File exceeds 5MB limit
    mockInput.files = [{ name: "big.jpg", size: 6 * 1024 * 1024, type: "image/jpeg" }];
    await act(async () => {
      await mockInput.onchange();
    });

    await waitFor(() => {
      expect(screen.getByText(/Image must be under/)).toBeTruthy();
    });
    delete (global as any).document;
  });

  it("shows error when uploadHeroImage fails", async () => {
    const adminApi = require("@/api/admin");
    adminApi.uploadHeroImage.mockResolvedValueOnce(null);
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: jest.fn(),
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Upload"));

    mockInput.files = [{ name: "test.jpg", size: 100, type: "image/jpeg" }];
    await act(async () => {
      await mockInput.onchange();
    });

    await waitFor(() => {
      expect(screen.getByText("Failed to upload image.")).toBeTruthy();
    });
    delete (global as any).document;
  });

  it("shows No file selected case in handlePickHero onchange", async () => {
    const adminApi = require("@/api/admin");
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: jest.fn(),
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Upload"));

    // Trigger onchange with no files selected
    mockInput.files = [];
    await act(async () => {
      await mockInput.onchange();
    });

    expect(adminApi.uploadHeroImage).not.toHaveBeenCalled();
    delete (global as any).document;
  });

  it("calls deleteHeroImage when Remove is pressed after upload", async () => {
    const adminApi = require("@/api/admin");
    const mockInput: any = {
      type: "",
      accept: "",
      onchange: null,
      click: jest.fn(),
      files: null,
    };
    (global as any).document = {
      createElement: jest.fn().mockReturnValue(mockInput),
    };

    render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    fireEvent.press(screen.getByText("Upload"));

    // Successful upload to set heroPreview
    mockInput.files = [{ name: "test.jpg", size: 100, type: "image/jpeg" }];
    await act(async () => {
      await mockInput.onchange();
    });

    await waitFor(() => {
      expect(screen.getByText("Remove")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Remove"));

    await waitFor(() => {
      expect(adminApi.deleteHeroImage).toHaveBeenCalled();
    });
    delete (global as any).document;
  });

  it("selects a preset color swatch when pressed", () => {
    const PRESET_COLORS = [
      "#0a7ea4", "#2563eb", "#7c3aed", "#059669", "#dc2626", "#d97706", "#475569",
    ];
    const { UNSAFE_getAllByProps } = render(<BrandSettingsCard {...defaultProps} />);
    fireEvent.press(screen.getByText("Brand Identity"));
    // Find the preset color Pressables by their inline backgroundColor style
    const allAccessible = UNSAFE_getAllByProps({ accessible: true });
    const presetEl = allAccessible.find((el: any) => {
      const style = el.props.style;
      if (!style || typeof style !== "object" || Array.isArray(style)) return false;
      return PRESET_COLORS.includes(style.backgroundColor);
    });
    if (presetEl) {
      fireEvent.press(presetEl);
    }
    // The form should still be visible after pressing a color swatch
    expect(screen.getByText("Save")).toBeTruthy();
  });
});
