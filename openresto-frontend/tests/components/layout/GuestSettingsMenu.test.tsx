import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import GuestSettingsMenu from "@/components/layout/GuestSettingsMenu";
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

const mockSetPreference = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
  (useLocale as jest.Mock).mockReturnValue({ locale: "en", setLocale: jest.fn() });
  (useTheme as jest.Mock).mockReturnValue({
    colorScheme: "light",
    preference: "system",
    setPreference: mockSetPreference,
    toggle: jest.fn(),
  });
});

const openMenu = () => {
  render(<GuestSettingsMenu />);
  fireEvent.press(screen.getByTestId("guest-settings-open"));
};

const openPane = (pane: string) => {
  openMenu();
  fireEvent.press(screen.getByTestId(`guest-settings-${pane}`));
};

/**
 * The menu hangs off its trigger rather than filling the screen, and each row opens one small
 * dialog. That split is the point: every control stacked in a single sheet outgrew the
 * viewport, and a settings list you have to scroll to reach the bottom of should have been a
 * menu. Nothing here may reintroduce a pane long enough to need scrolling.
 */
describe("GuestSettingsMenu", () => {
  it("stays closed until the trigger is pressed", () => {
    render(<GuestSettingsMenu />);
    expect(screen.queryByTestId("guest-settings-menu")).toBeNull();
  });

  it("opens a menu of four rows, not a screenful of controls", () => {
    openMenu();
    expect(screen.getByTestId("guest-settings-menu")).toBeTruthy();
    expect(screen.getByTestId("guest-settings-language")).toBeTruthy();
    expect(screen.getByTestId("guest-settings-appearance")).toBeTruthy();
    expect(screen.getByTestId("guest-settings-about")).toBeTruthy();
    expect(screen.getByTestId("guest-settings-help")).toBeTruthy();
  });

  /** A row that answers before it is opened saves opening it to find out. */
  it("shows the current language and theme on their rows", () => {
    openMenu();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
  });

  it("offers no keyboard shortcuts row, since shortcuts do not fire off web", () => {
    openMenu();
    expect(screen.queryByText(/keyboard/i)).toBeNull();
  });

  it("closes the menu when a row opens its pane", () => {
    openPane("appearance");
    expect(screen.queryByTestId("guest-settings-menu")).toBeNull();
    expect(screen.getByTestId("guest-settings-dialog")).toBeTruthy();
  });

  describe("panes", () => {
    it("writes a theme pick through setPreference", () => {
      openPane("appearance");
      fireEvent.press(screen.getByLabelText("Dark"));
      expect(mockSetPreference).toHaveBeenCalledWith("dark");
    });

    it("offers every supported language", () => {
      openPane("language");
      expect(screen.getByText("Français")).toBeTruthy();
      expect(screen.getByText("Deutsch")).toBeTruthy();
    });

    it("carries the privacy policy the app stores require a listing to reach", () => {
      openPane("about");
      fireEvent.press(screen.getByTestId("guest-settings-link-privacy"));
      expect(openExternal).toHaveBeenCalledWith("https://example.com/privacy");
    });

    it("lists the configured social links and opens one externally", async () => {
      (fetchSocialLinks as jest.Mock).mockResolvedValue([
        { id: 1, label: "Instagram", iconKey: "logo-instagram", url: "https://instagram.com/r" },
      ]);
      openPane("about");

      fireEvent.press(await screen.findByTestId("guest-settings-link-1"));
      expect(openExternal).toHaveBeenCalledWith("https://instagram.com/r");
    });

    it("shows the copyright the web footer carries", () => {
      openPane("about");
      expect(screen.getByTestId("guest-settings-copyright")).toBeTruthy();
    });

    it("asks the server for the social links only when About is opened", async () => {
      openPane("help");
      await waitFor(() => expect(screen.getByTestId("guest-settings-help")).toBeTruthy());
      expect(fetchSocialLinks).not.toHaveBeenCalled();
    });

    it("closes on the close button", () => {
      openPane("help");
      fireEvent.press(screen.getByTestId("guest-settings-close"));
      expect(screen.queryByTestId("guest-settings-dialog")).toBeNull();
    });
  });
});
