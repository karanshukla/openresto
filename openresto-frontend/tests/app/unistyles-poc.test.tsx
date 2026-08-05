/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import UnistylesPocScreen from "@/app/(user)/unistyles-poc";
import { BrandProvider } from "@/context/BrandContext";

const mockSetPreference = jest.fn();
const mockToggle = jest.fn();

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    colorScheme: "light",
    preference: "system",
    setPreference: mockSetPreference,
    toggle: mockToggle,
  }),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

const renderScreen = () =>
  render(
    <BrandProvider>
      <UnistylesPocScreen />
    </BrandProvider>
  );

describe("UnistylesPocScreen", () => {
  beforeEach(() => {
    mockSetPreference.mockClear();
    mockToggle.mockClear();
  });

  it("renders the spike heading", () => {
    renderScreen();
    expect(screen.getByText("Unistyles spike")).toBeTruthy();
  });

  it("reports the runtime state resolved from the Unistyles registry", () => {
    renderScreen();
    expect(screen.getByText("Unistyles theme")).toBeTruthy();
    expect(screen.getByText("ThemeContext scheme")).toBeTruthy();
    expect(screen.getByText("light")).toBeTruthy();
  });

  it("renders one swatch per theme colour token", () => {
    renderScreen();
    expect(screen.getByText("muted")).toBeTruthy();
    expect(screen.getByText("border")).toBeTruthy();
    // "primary" is both a colour token and a Button size, so it renders twice.
    expect(screen.getAllByText("primary")).toHaveLength(2);
  });

  it("renders every Button variant", () => {
    renderScreen();
    expect(screen.getByText("secondary")).toBeTruthy();
    expect(screen.getByText("small")).toBeTruthy();
    expect(screen.getByText("icon")).toBeTruthy();
    expect(screen.getByText("disabled")).toBeTruthy();
  });

  it("drives the theme through ThemeContext rather than the runtime directly", () => {
    renderScreen();

    fireEvent.press(screen.getByText("Toggle"));
    expect(mockToggle).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("Dark"));
    expect(mockSetPreference).toHaveBeenCalledWith("dark");

    fireEvent.press(screen.getByText("System"));
    expect(mockSetPreference).toHaveBeenCalledWith("system");
  });

  it("renders the breakpoint-driven tiles", () => {
    renderScreen();
    expect(screen.getByText("Tile 1")).toBeTruthy();
    expect(screen.getByText("Tile 4")).toBeTruthy();
  });
});
