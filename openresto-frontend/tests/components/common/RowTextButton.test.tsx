import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";
import { RowTextButton } from "@/components/common/RowTextButton";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) =>
    require("react").createElement("Text", { testID: `icon-${name}` }, name),
}));

const resolvedStyle = () => StyleSheet.flatten(screen.getByRole("button").props.style) as ViewStyle;

/**
 * The leading glyph is decorative — <Icon> hides it from the accessibility tree on purpose —
 * so it is only reachable with hidden elements included.
 */
const queryIcon = (name: string) =>
  screen.queryByTestId(`icon-${name}`, { includeHiddenElements: true });

describe("RowTextButton", () => {
  const baseProps = { label: "Edit", color: "#0a7ea4" };

  it("renders its label", () => {
    render(<RowTextButton {...baseProps} />);
    expect(screen.getByText("Edit")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<RowTextButton {...baseProps} onPress={onPress} />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("falls back to the label for the accessibility label", () => {
    render(<RowTextButton {...baseProps} />);
    expect(screen.getByLabelText("Edit")).toBeTruthy();
  });

  it("prefers an explicit accessibilityLabel over the label", () => {
    render(<RowTextButton {...baseProps} accessibilityLabel="Edit the Patio section" />);
    expect(screen.getByLabelText("Edit the Patio section")).toBeTruthy();
    expect(screen.queryByLabelText("Edit")).toBeNull();
  });

  it("renders a leading icon when one is supplied", () => {
    render(<RowTextButton {...baseProps} icon="pencil" />);
    expect(queryIcon("pencil")).toBeTruthy();
  });

  it("keeps the leading icon out of the accessibility tree", () => {
    render(<RowTextButton {...baseProps} icon="pencil" />);
    expect(screen.queryByTestId("icon-pencil")).toBeNull();
  });

  it("renders no icon by default", () => {
    render(<RowTextButton {...baseProps} />);
    expect(screen.queryByTestId(/^icon-/, { includeHiddenElements: true })).toBeNull();
  });

  it("applies the passed testID", () => {
    render(<RowTextButton {...baseProps} testID="edit-section" />);
    expect(screen.getByTestId("edit-section")).toBeTruthy();
  });

  it("is enabled and undimmed at rest", () => {
    render(<RowTextButton {...baseProps} />);
    expect(screen.getByRole("button").props.accessibilityState).toEqual({ disabled: false });
    expect(resolvedStyle().opacity).toBeUndefined();
  });

  it("dims to 0.5 when disabled", () => {
    render(<RowTextButton {...baseProps} disabled />);
    expect(resolvedStyle().opacity).toBe(0.5);
  });

  it("marks itself disabled for assistive tech and ignores presses", () => {
    const onPress = jest.fn();
    render(<RowTextButton {...baseProps} disabled onPress={onPress} />);
    expect(screen.getByRole("button").props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("borders with the supplied color", () => {
    render(<RowTextButton {...baseProps} color="#c00" />);
    expect(resolvedStyle().borderColor).toBe("#c00");
  });

  it("merges a caller-supplied style over its own", () => {
    render(<RowTextButton {...baseProps} style={{ marginLeft: 8 }} />);
    expect(resolvedStyle().marginLeft).toBe(8);
  });

  /* A plain action carries no selection state — see "is enabled and undimmed at rest" above,
     which pins accessibilityState to exactly { disabled: false }. */
  it("fills with its color and announces the state when selected", () => {
    render(<RowTextButton {...baseProps} label="Pin" selected color="#0a7ea4" />);
    expect(resolvedStyle().backgroundColor).toBe("#0a7ea4");
    expect(screen.getByRole("button").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("stays unfilled but still announces the state when deselected", () => {
    render(<RowTextButton {...baseProps} label="Pin" selected={false} />);
    expect(resolvedStyle().backgroundColor).toBeUndefined();
    expect(screen.getByRole("button").props.accessibilityState).toMatchObject({ selected: false });
  });

  it("reaches the 44px touch target through hitSlop", () => {
    render(<RowTextButton {...baseProps} />);
    expect(screen.getByRole("button").props.hitSlop).toEqual({
      top: 10,
      bottom: 10,
      left: 8,
      right: 8,
    });
  });
});
