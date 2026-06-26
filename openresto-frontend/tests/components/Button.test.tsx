import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import Button from "@/components/common/Button";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#0a7ea4" })),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
}));

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress}>Press</Button>);
    fireEvent.press(screen.getByText("Press"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} disabled>
        Disabled
      </Button>
    );
    fireEvent.press(screen.getByText("Disabled"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders with default primary size", () => {
    render(<Button>Primary</Button>);
    expect(screen.getByText("Primary")).toBeTruthy();
  });

  it("renders with secondary size", () => {
    render(<Button size="secondary">Secondary</Button>);
    expect(screen.getByText("Secondary")).toBeTruthy();
  });

  it("renders with small size", () => {
    render(<Button size="small">Small</Button>);
    expect(screen.getByText("Small")).toBeTruthy();
  });

  it("renders with icon size", () => {
    render(<Button size="icon">★</Button>);
    expect(screen.getByText("★")).toBeTruthy();
  });

  it("falls back to COLORS.primary when brand has no primaryColor", () => {
    const { useBrand } = require("@/context/BrandContext");
    (useBrand as jest.Mock).mockReturnValueOnce({ appName: "Test", primaryColor: "" });
    render(<Button>Fallback</Button>);
    expect(screen.getByText("Fallback")).toBeTruthy();
  });

  it("renders correctly in dark mode", () => {
    const { useColorScheme } = require("@/hooks/use-color-scheme");
    (useColorScheme as jest.Mock).mockReturnValueOnce("dark");
    render(<Button>Dark</Button>);
    expect(screen.getByText("Dark")).toBeTruthy();
  });
});
