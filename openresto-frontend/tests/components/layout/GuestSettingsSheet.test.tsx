import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import GuestSettingsSheet from "@/components/layout/GuestSettingsSheet";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";

jest.mock("@/context/LocaleContext", () => ({ useLocale: jest.fn() }));
jest.mock("@/context/ThemeContext", () => ({ useTheme: jest.fn() }));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", input: "#f5f5f5", card: "#fff", border: "#ccc" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

const mockSetLocale = jest.fn();
const mockSetPreference = jest.fn();
const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useLocale as jest.Mock).mockReturnValue({ locale: "en", setLocale: mockSetLocale });
  (useTheme as jest.Mock).mockReturnValue({
    colorScheme: "light",
    preference: "system",
    setPreference: mockSetPreference,
    toggle: jest.fn(),
  });
});

const renderSheet = () => render(<GuestSettingsSheet visible onClose={onClose} />);

describe("GuestSettingsSheet", () => {
  it("offers both language and appearance, the two the web overflow menu owns", () => {
    renderSheet();

    expect(screen.getByTestId("language-radiogroup")).toBeTruthy();
    expect(screen.getByTestId("theme-radiogroup")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
  });

  it("marks the active theme preference checked, and the others not", () => {
    renderSheet();

    expect(screen.getByLabelText("System").props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByLabelText("Dark").props.accessibilityState).toEqual({ checked: false });
  });

  it("writes a theme pick through ThemeContext without dismissing itself", () => {
    renderSheet();

    fireEvent.press(screen.getByLabelText("Dark"));

    expect(mockSetPreference).toHaveBeenCalledWith("dark");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("writes a language pick through LocaleContext", () => {
    renderSheet();

    fireEvent.press(screen.getByLabelText("Français"));

    expect(mockSetLocale).toHaveBeenCalledWith("fr");
  });

  it("dismisses on its close button and on the backdrop", () => {
    renderSheet();

    fireEvent.press(screen.getByTestId("guest-settings-close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByLabelText("Close settings", { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("highlights the theme row under the pointer", () => {
    renderSheet();

    let node: ReturnType<typeof screen.getByLabelText> | null = screen.getByLabelText("Light");
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: {
      hovered: boolean;
      pressed: boolean;
    }) => unknown[];

    expect(styleFn({ hovered: false, pressed: true })).toContainEqual({
      backgroundColor: "#f5f5f5",
    });
    expect(styleFn({ hovered: false, pressed: false })).not.toContainEqual({
      backgroundColor: "#f5f5f5",
    });
  });

  it("renders nothing while hidden", () => {
    render(<GuestSettingsSheet visible={false} onClose={onClose} />);

    expect(screen.queryByTestId("theme-radiogroup")).toBeNull();
  });
});
