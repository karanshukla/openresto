/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { HeaderImageCard } from "@/components/admin/settings/HeaderImageCard";
import * as adminApi from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  saveBrandSettings: jest.fn(),
  uploadHeroImage: jest.fn(),
  deleteHeroImage: jest.fn(),
}));

let mockBrandData: {
  primaryColor: string;
  appName: string;
  headerImageUrl: string | null;
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

/** A file input stub the card's `document.createElement("input")` picks up. */
function stubFileInput(files: File[]) {
  const mockInput = {
    type: "",
    accept: "",
    onchange: null as ((e: Event) => void) | null,
    click: jest.fn(),
    files,
  };
  jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
  return mockInput;
}

describe("HeaderImageCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue({
      ok: true,
      data: { message: "Saved." },
    });
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto", headerImageUrl: null };
  });

  it("renders with the Homepage Header title", () => {
    render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText("Homepage Header")).toBeTruthy();
  });

  it("says no image is set in its subtitle", () => {
    render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText(/No image · brand gradient/)).toBeTruthy();
  });

  it("summarises the image and its fit once one is set", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: "https://example.com/hero.jpg",
      headerImageFit: "Contain",
    };
    render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText(/Image set · Contain/)).toBeTruthy();
  });

  it("collapses when the header is pressed", () => {
    render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText("Image fit")).toBeTruthy();
    fireEvent.press(screen.getByText("Homepage Header"));
    expect(screen.queryByText("Image fit")).toBeNull();
  });

  it("shows Upload button when no hero image", () => {
    render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("calls uploadHeroImage and shows success when file is selected", async () => {
    const mockFile = new File(["content"], "hero.jpg", { type: "image/jpeg" });
    const mockInput = stubFileInput([mockFile]);
    (adminApi.uploadHeroImage as jest.Mock).mockResolvedValue("https://example.com/hero.jpg");
    render(<HeaderImageCard {...baseProps} />);
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
    const mockInput = stubFileInput([mockFile]);
    (adminApi.uploadHeroImage as jest.Mock).mockResolvedValue(null);
    render(<HeaderImageCard {...baseProps} />);
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
    const mockInput = stubFileInput([largeFile]);
    render(<HeaderImageCard {...baseProps} />);
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
    const mockInput = stubFileInput([]);
    render(<HeaderImageCard {...baseProps} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    expect(adminApi.uploadHeroImage).not.toHaveBeenCalled();
  });

  it("shows Change and Remove buttons when a hero image exists", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: "https://example.com/hero.jpg",
    };
    render(<HeaderImageCard {...baseProps} />);
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
    render(<HeaderImageCard {...baseProps} />);
    await act(async () => {
      fireEvent.press(screen.getByText("Remove"));
    });
    expect(adminApi.deleteHeroImage).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Header image removed.")).toBeTruthy();
    });
  });

  // The fit control is the shared `Select`: its trigger renders the selected option's label,
  // and choosing a value means pressing that trigger then the option inside the modal.
  const COVER_FIT = "Cover (fill, may crop)";
  const CONTAIN_FIT = "Contain (show whole image)";
  const chooseContainFit = () => {
    fireEvent.press(screen.getByText(COVER_FIT));
    fireEvent.press(screen.getByText(CONTAIN_FIT));
  };

  it("renders the image fit select defaulting to Cover", () => {
    render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText(COVER_FIT)).toBeTruthy();
  });

  it("pre-fills headerImageFit from brand context", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: null,
      headerImageFit: "Contain",
    };
    render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText(CONTAIN_FIT)).toBeTruthy();
  });

  it("autosaves the image fit when it changes", async () => {
    render(<HeaderImageCard {...baseProps} />);
    chooseContainFit();
    // The save is debounced past the last change, so it lands inside the waitFor window.
    await waitFor(
      () => expect(adminApi.saveBrandSettings).toHaveBeenCalledWith({ headerImageFit: "Contain" }),
      { timeout: 2000 }
    );
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy());
  });

  it("reports an unreachable server", async () => {
    (adminApi.saveBrandSettings as jest.Mock).mockResolvedValue(null);
    render(<HeaderImageCard {...baseProps} />);
    chooseContainFit();
    await waitFor(() => expect(screen.getByText("Couldn't reach the server.")).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it("syncs the stored image and fit when brand context updates", async () => {
    const { rerender } = render(<HeaderImageCard {...baseProps} />);
    expect(screen.getByText(/No image/)).toBeTruthy();
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Open Resto",
      headerImageUrl: "https://example.com/hero.jpg",
      headerImageFit: "Contain",
    };
    await act(async () => {
      rerender(<HeaderImageCard {...baseProps} />);
    });
    expect(screen.getByText(/Image set · Contain/)).toBeTruthy();
  });
});
