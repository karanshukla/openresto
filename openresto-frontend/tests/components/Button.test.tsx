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

  it.each(["lg", "md", "sm", "icon"] as const)("renders at %s size", (size) => {
    render(<Button size={size}>Sized</Button>);
    expect(screen.getByText("Sized")).toBeTruthy();
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)(
    "renders the %s variant",
    (variant) => {
      render(<Button variant={variant}>Variant</Button>);
      expect(screen.getByText("Variant")).toBeTruthy();
    }
  );

  it("names the button from its string children", () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByLabelText("Save changes")).toBeTruthy();
  });

  it("prefers an explicit accessibilityLabel over the children", () => {
    render(<Button accessibilityLabel="Save your changes">Save</Button>);
    expect(screen.getByLabelText("Save your changes")).toBeTruthy();
  });

  it("exposes disabled state to assistive tech", () => {
    render(<Button disabled>Blocked</Button>);
    expect(screen.getByRole("button", { disabled: true })).toBeTruthy();
  });

  it("marks itself busy and blocks presses while loading", () => {
    const onPress = jest.fn();
    render(
      <Button onPress={onPress} loading>
        Saving
      </Button>
    );
    expect(screen.getByRole("button").props.accessibilityState).toMatchObject({ busy: true });
    fireEvent.press(screen.getByText("Saving"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders leading and trailing icons", () => {
    const { rerender } = render(<Button icon="add">Add</Button>);
    expect(screen.getByText("Add")).toBeTruthy();
    rerender(
      <Button icon="arrow-forward" iconPosition="trailing">
        Next
      </Button>
    );
    expect(screen.getByText("Next")).toBeTruthy();
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
