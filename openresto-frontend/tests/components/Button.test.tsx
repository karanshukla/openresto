import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";
import Button from "@/components/common/Button";
import { theme } from "@/theme/theme";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#0a7ea4" })),
}));

jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
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

  describe("tone", () => {
    const surface = () => StyleSheet.flatten(screen.getByRole("button").props.style) as ViewStyle;
    const labelColor = () => StyleSheet.flatten(screen.getByText("Act").props.style) as TextStyle;

    it.each(["brand", "danger", "warning", "success", "neutral"] as const)(
      "renders the %s tone",
      (tone) => {
        render(<Button tone={tone}>Act</Button>);
        expect(screen.getByText("Act")).toBeTruthy();
      }
    );

    it("fills a primary button with its tone", () => {
      render(<Button tone="danger">Act</Button>);
      expect(surface().backgroundColor).toBe(theme.colors.error);
      expect(labelColor().color).toBe(theme.colors.white);
    });

    it("outlines a secondary button in its tone and leaves it unfilled", () => {
      render(
        <Button variant="secondary" tone="danger">
          Act
        </Button>
      );
      expect(surface().borderColor).toBe(theme.colors.error);
      expect(surface().backgroundColor).toBeUndefined();
      expect(labelColor().color).toBe(theme.colors.error);
    });

    /**
     * `variant="danger"` predates the tone axis; it has to keep meaning "filled destructive"
     * so call sites written against the old API don't silently turn brand-coloured.
     */
    it("keeps variant='danger' as filled destructive", () => {
      render(<Button variant="danger">Act</Button>);
      expect(surface().backgroundColor).toBe(theme.colors.error);
    });

    it("lets an explicit tone override the legacy danger variant", () => {
      render(
        <Button variant="danger" tone="brand">
          Act
        </Button>
      );
      expect(surface().backgroundColor).toBe("#0a7ea4");
    });

    it("greys out to the disabled surface regardless of tone", () => {
      render(
        <Button tone="danger" disabled>
          Act
        </Button>
      );
      expect(surface().backgroundColor).not.toBe(theme.colors.error);
    });
  });

  describe("accentColor", () => {
    const surface = () => StyleSheet.flatten(screen.getByRole("button").props.style) as ViewStyle;
    const labelColor = () => StyleSheet.flatten(screen.getByText("Act").props.style) as TextStyle;

    /**
     * A brand blue chosen to look like its logo is a 3:1 colour, which an outline and a glyph
     * may spend but a label may not — so the label has to stay out of it.
     */
    it("outlines in the brand colour but leaves the label at reading contrast", () => {
      render(
        <Button variant="secondary" accentColor="#4285f4">
          Act
        </Button>
      );
      expect(surface().borderColor).toBe("#4285f4");
      expect(labelColor().color).not.toBe("#4285f4");
    });

    it("wins over an explicit tone on the outline", () => {
      render(
        <Button variant="secondary" tone="neutral" accentColor="#4285f4">
          Act
        </Button>
      );
      expect(surface().borderColor).toBe("#4285f4");
    });

    it("still yields to the disabled treatment", () => {
      render(
        <Button variant="secondary" accentColor="#4285f4" disabled>
          Act
        </Button>
      );
      expect(surface().borderColor).not.toBe("#4285f4");
    });
  });

  it("stretches only when fullWidth is set", () => {
    const { rerender } = render(<Button>Act</Button>);
    const surface = () => StyleSheet.flatten(screen.getByRole("button").props.style) as ViewStyle;
    expect(surface().alignSelf).toBeUndefined();
    rerender(<Button fullWidth>Act</Button>);
    expect(surface().alignSelf).toBe("stretch");
    expect(surface().width).toBe("100%");
  });

  it("merges a caller-supplied accessibilityState with its own", () => {
    render(<Button accessibilityState={{ expanded: true }}>Act</Button>);
    expect(screen.getByRole("button").props.accessibilityState).toMatchObject({
      expanded: true,
      disabled: false,
      busy: false,
    });
  });
});
