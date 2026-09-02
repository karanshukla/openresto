import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import GuestSettingsSheet from "@/components/layout/GuestSettingsSheet";
import { useLocale } from "@/context/LocaleContext";
import { useTheme } from "@/context/ThemeContext";
import { fetchSocialLinks } from "@/api/restaurants";
import { openExternal } from "@/utils/openExternal";

jest.mock("@/api/restaurants", () => ({ fetchSocialLinks: jest.fn() }));
jest.mock("@/utils/openExternal", () => ({ openExternal: jest.fn() }));

jest.mock("@/context/LocaleContext", () => ({ useLocale: jest.fn() }));
jest.mock("@/context/ThemeContext", () => ({ useTheme: jest.fn() }));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: {
      appName: "Test App",
      primaryColor: "#0a7ea4",
      privacyPolicyUrl: "https://example.com/privacy",
      copyrightText: "",
    },
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
  (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
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

/**
 * The web overflow menu carries Help; the native sheet is the only place a diner on a phone
 * can reach it. Keyboard shortcuts, that menu's fourth row, has no counterpart on purpose —
 * `useKeyboardShortcuts` no-ops off web, so the row would open help for nothing.
 */
describe("help", () => {
  it("carries the same help copy the web overflow menu shows", () => {
    render(<GuestSettingsSheet visible onClose={onClose} />);
    expect(screen.getByTestId("guest-settings-help")).toBeTruthy();
  });

  it("offers no keyboard shortcuts row, since shortcuts do not fire off web", () => {
    render(<GuestSettingsSheet visible onClose={onClose} />);
    expect(screen.queryByText(/keyboard/i)).toBeNull();
  });
});

/**
 * What a website puts in its footer lives here instead: the native app has screens rather than
 * one long document, so the band that ended every web page became an About section a guest
 * opens deliberately. The admin link is the one part that does not come across —
 * `app/admin/_layout.tsx` redirects off web, so it would point at a screen that bounces back.
 */
describe("about", () => {
  it("lists the configured social links and opens one externally", async () => {
    (fetchSocialLinks as jest.Mock).mockResolvedValue([
      { id: 1, label: "Instagram", iconKey: "logo-instagram", url: "https://instagram.com/r" },
    ]);
    render(<GuestSettingsSheet visible onClose={onClose} />);

    const link = await screen.findByLabelText("Instagram");
    fireEvent.press(link);
    expect(openExternal).toHaveBeenCalledWith("https://instagram.com/r");
  });

  it("carries the privacy policy the app stores require a listing to reach", () => {
    render(<GuestSettingsSheet visible onClose={onClose} />);
    fireEvent.press(screen.getByTestId("guest-settings-privacy"));
    expect(openExternal).toHaveBeenCalledWith("https://example.com/privacy");
  });

  it("shows the copyright the web footer used to carry", () => {
    render(<GuestSettingsSheet visible onClose={onClose} />);
    expect(screen.getByTestId("guest-settings-copyright")).toBeTruthy();
  });

  it("offers no admin link, which off web only bounces back to the home screen", () => {
    render(<GuestSettingsSheet visible onClose={onClose} />);
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("asks the server for the links only once the sheet is open", () => {
    render(<GuestSettingsSheet visible={false} onClose={onClose} />);
    expect(fetchSocialLinks).not.toHaveBeenCalled();
  });
});
