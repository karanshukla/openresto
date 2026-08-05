import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { ViewStyle } from "react-native";
import LargePartyNotice from "@/components/booking/LargePartyNotice";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const mockTheme = {
  colors: { text: "#111", muted: "#666" },
  primaryColor: "#0a7ea4",
};

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => mockTheme,
}));

/**
 * The card is styled from a hex brand color parsed into rgba() tints. A malformed or shorthand
 * hex would silently produce `rgba(NaN,NaN,NaN,0.10)` — an invisible card — so the derived tints
 * are asserted rather than assumed.
 */
const cardStyle = () =>
  (screen.getByRole("button").props.style as ViewStyle[]).reduce<ViewStyle>(
    (acc, s) => ({ ...acc, ...(s ?? {}) }),
    {}
  );

describe("LargePartyNotice", () => {
  beforeEach(() => {
    mockTheme.primaryColor = "#0a7ea4";
  });

  it("names the largest table capacity in its body copy", () => {
    render(<LargePartyNotice maxCapacity={8} onContact={jest.fn()} />);
    expect(screen.getByText(/Our largest table seats 8\./)).toBeTruthy();
  });

  it("renders the title and contact affordance", () => {
    render(<LargePartyNotice maxCapacity={8} onContact={jest.fn()} />);
    expect(screen.getByText("Large party")).toBeTruthy();
    expect(screen.getByText("Contact us →")).toBeTruthy();
  });

  it("calls onContact when the card is pressed", () => {
    const onContact = jest.fn();
    render(<LargePartyNotice maxCapacity={8} onContact={onContact} />);
    fireEvent.press(screen.getByRole("button"));
    expect(onContact).toHaveBeenCalledTimes(1);
  });

  it("exposes a descriptive accessibility label", () => {
    render(<LargePartyNotice maxCapacity={8} onContact={jest.fn()} />);
    expect(screen.getByLabelText("Contact us about a large party")).toBeTruthy();
  });

  it("derives soft fill and border tints from the brand color", () => {
    render(<LargePartyNotice maxCapacity={8} onContact={jest.fn()} />);
    const style = cardStyle();
    // #0a7ea4 → 10, 126, 164
    expect(style.backgroundColor).toBe("rgba(10,126,164,0.10)");
    expect(style.borderColor).toBe("rgba(10,126,164,0.28)");
  });

  it("parses a brand color written without the leading hash", () => {
    mockTheme.primaryColor = "ff0000";
    render(<LargePartyNotice maxCapacity={4} onContact={jest.fn()} />);
    expect(cardStyle().backgroundColor).toBe("rgba(255,0,0,0.10)");
  });

  it("is not dimmed when not hovered", () => {
    render(<LargePartyNotice maxCapacity={8} onContact={jest.fn()} />);
    expect(cardStyle().opacity).toBeUndefined();
  });
});
