/**
 * @jest-environment jsdom
 *
 * Dismissal paths and the dark-mode variant of the overflow menu. The main panel's backdrop and
 * both modals' `onRequestClose` (Android back / Esc on web) are the only ways out of the menu
 * besides picking a row — a regression there traps the user behind a transparent overlay.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Modal } from "react-native";
import OverflowMenu from "@/components/layout/OverflowMenu";
import { fetchSocialLinks } from "@/api/restaurants";

const mockToggle = jest.fn();
let mockIsDark = false;

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    colors: { border: "#ccc", muted: "#666", card: "#fff", input: "#eee", text: "#111" },
    isDark: mockIsDark,
  }),
}));

jest.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ toggle: mockToggle }) }));
jest.mock("@/context/BrandContext", () => ({ useBrand: () => ({ appName: "Test App" }) }));
jest.mock("@/context/LocaleContext", () => ({
  useLocale: () => ({ locale: "en", setLocale: jest.fn() }),
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/api/restaurants", () => ({ fetchSocialLinks: jest.fn() }));

const openMenu = () => fireEvent.press(screen.getByLabelText("Open menu"));

describe("OverflowMenu in dark mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDark = true;
    (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
  });

  it("offers the light-mode switch instead of the dark one", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();
    expect(screen.getByText("Switch to light mode")).toBeTruthy();
    expect(screen.queryByText("Switch to dark mode")).toBeNull();
  });

  it("still toggles the theme from the light-mode row", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();
    fireEvent.press(screen.getByLabelText("Switch to light mode"));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});

describe("OverflowMenu dismissal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDark = false;
    (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
  });

  const panelModal = () => screen.UNSAFE_getAllByType(Modal)[0];
  const helpModal = () => screen.UNSAFE_getAllByType(Modal)[1];
  const languageModal = () => screen.UNSAFE_getAllByType(Modal)[2];

  it("opens the panel on the trigger press", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    expect(panelModal().props.visible).toBe(false);
    openMenu();
    expect(panelModal().props.visible).toBe(true);
  });

  it("closes the panel when its backdrop is pressed", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();

    // Pressed on the backdrop itself: the panel swallows its own presses, so a press on the
    // card does not reach it.
    fireEvent.press(screen.getByTestId("menu-backdrop"));

    expect(panelModal().props.visible).toBe(false);
  });

  it("closes the panel on a hardware/Esc request", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();
    expect(panelModal().props.visible).toBe(true);

    fireEvent(panelModal(), "requestClose");

    expect(panelModal().props.visible).toBe(false);
  });

  it("closes the Help popup on a hardware/Esc request", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();
    fireEvent.press(screen.getByLabelText("Help"));
    expect(helpModal().props.visible).toBe(true);

    fireEvent(helpModal(), "requestClose");

    expect(helpModal().props.visible).toBe(false);
  });

  it("closes the panel before opening Help, so the two never stack", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();
    fireEvent.press(screen.getByLabelText("Help"));

    expect(panelModal().props.visible).toBe(false);
    expect(helpModal().props.visible).toBe(true);
  });

  it("closes the panel before handing off to the shortcuts overlay", () => {
    const onOpenShortcuts = jest.fn();
    render(<OverflowMenu onOpenShortcuts={onOpenShortcuts} />);
    openMenu();
    fireEvent.press(screen.getByLabelText("View keyboard shortcuts"));

    expect(panelModal().props.visible).toBe(false);
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
  });

  it("closes the panel before opening the language modal, so the two never stack", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();
    fireEvent.press(screen.getByLabelText("Language"));

    expect(panelModal().props.visible).toBe(false);
    expect(languageModal().props.visible).toBe(true);
  });

  it("closes the language modal on a hardware/Esc request", () => {
    render(<OverflowMenu onOpenShortcuts={jest.fn()} />);
    openMenu();
    fireEvent.press(screen.getByLabelText("Language"));
    expect(languageModal().props.visible).toBe(true);

    fireEvent(languageModal(), "requestClose");

    expect(languageModal().props.visible).toBe(false);
  });
});
