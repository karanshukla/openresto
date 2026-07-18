/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";
import OverflowMenu from "@/components/layout/OverflowMenu";
import { fetchSocialLinks } from "@/api/restaurants";

const mockToggle = jest.fn();
let mockBrand: Record<string, unknown> = { appName: "Test App" };

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    colors: { border: "#ccc", muted: "#666", card: "#fff", input: "#eee", text: "#111" },
    isDark: false,
  }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ toggle: mockToggle }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrand,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  fetchSocialLinks: jest.fn(),
}));

describe("OverflowMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrand = { appName: "Test App" };
    (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
  });

  it("opens the panel with Help, dark-mode toggle, and shortcuts rows", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    expect(screen.getByText("Help")).toBeTruthy();
    expect(screen.getByText("Switch to dark mode")).toBeTruthy();
    expect(screen.getByText("Keyboard shortcuts")).toBeTruthy();
  });

  it("calls toggle when the dark-mode row is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Switch to dark mode"));
    expect(mockToggle).toHaveBeenCalled();
  });

  it("calls onOpenShortcuts when the shortcuts row is pressed", () => {
    const onOpenShortcuts = jest.fn();
    render(<OverflowMenu onOpenShortcuts={onOpenShortcuts} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("View keyboard shortcuts"));
    expect(onOpenShortcuts).toHaveBeenCalled();
  });

  it("opens a static Help popup, not a guided tour, when Help is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    expect(screen.getByText(/Open the Locations page/i)).toBeTruthy();
  });

  it("closes the Help popup when its close button is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    fireEvent.press(screen.getByTestId("help-close"));
    expect(screen.queryByTestId("help-close")).toBeNull();
  });

  it("closes the Help popup when the backdrop is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    fireEvent.press(screen.getByTestId("help-backdrop"));
    expect(screen.queryByTestId("help-close")).toBeNull();
  });

  it("does not show a website link in Help when none is configured", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    expect(screen.queryByLabelText("Visit our website")).toBeNull();
  });

  it("shows and opens a website link in Help when configured", () => {
    mockBrand = { appName: "Test App", websiteUrl: "https://example.com" };
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Help"));
    fireEvent.press(screen.getByLabelText("Visit our website"));
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com");
  });

  it("renders no social links when none are configured", async () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    await waitFor(() => expect(fetchSocialLinks).toHaveBeenCalled());
    fireEvent.press(screen.getByLabelText("Open menu"));
    expect(screen.queryByLabelText("Instagram")).toBeNull();
  });

  it("renders configured social links and opens their URL on press", async () => {
    (fetchSocialLinks as jest.Mock).mockResolvedValue([
      {
        id: 1,
        label: "Instagram",
        url: "https://instagram.com/resto",
        iconKey: "logo-instagram",
        sortOrder: 0,
      },
    ]);
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    fireEvent.press(screen.getByLabelText("Open menu"));

    const instagramBtn = await screen.findByLabelText("Instagram");
    fireEvent.press(instagramBtn);
    expect(Linking.openURL).toHaveBeenCalledWith("https://instagram.com/resto");
  });
});
