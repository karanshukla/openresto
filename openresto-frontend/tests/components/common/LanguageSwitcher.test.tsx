/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useLocale } from "@/context/LocaleContext";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#000" })),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

jest.mock("@/context/LocaleContext", () => ({
  useLocale: jest.fn(),
}));

describe("LanguageSwitcher", () => {
  const setLocale = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocale as jest.Mock).mockReturnValue({ locale: "en", setLocale });
  });

  it("shows the active locale's own-language label", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText("English")).toBeTruthy();
  });

  it("lists every supported locale in its own language when opened", () => {
    render(<LanguageSwitcher />);
    fireEvent.press(screen.getByText("English"));
    expect(screen.getByText("Français")).toBeTruthy();
    expect(screen.getByText("Español")).toBeTruthy();
    expect(screen.getByText("Deutsch")).toBeTruthy();
  });

  it("calls setLocale with the picked locale code", () => {
    render(<LanguageSwitcher />);
    fireEvent.press(screen.getByText("English"));
    fireEvent.press(screen.getByText("Français"));
    expect(setLocale).toHaveBeenCalledWith("fr");
  });

  it("reflects a non-English active locale as the current selection", () => {
    (useLocale as jest.Mock).mockReturnValue({ locale: "de", setLocale });
    render(<LanguageSwitcher />);
    expect(screen.getByText("Deutsch")).toBeTruthy();
  });
});
