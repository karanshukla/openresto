import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import type { ViewStyle } from "react-native";
import { RowTextButton } from "@/components/admin/settings/RowTextButton";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: ({ name }: { name: string }) =>
    require("react").createElement("Text", { testID: `icon-${name}` }, name),
}));

/**
 * Pressable resolves its function-style prop before it reaches the host view, so the rendered
 * style is a two-slot array: the component's own base style, then whatever the caller passed.
 */
const resolvedStyle = () => screen.getByRole("button").props.style as [ViewStyle, ViewStyle | null];

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
    expect(screen.getByTestId("icon-pencil")).toBeTruthy();
  });

  it("renders no icon by default", () => {
    render(<RowTextButton {...baseProps} />);
    expect(screen.queryByTestId(/^icon-/)).toBeNull();
  });

  it("applies the passed testID", () => {
    render(<RowTextButton {...baseProps} testID="edit-section" />);
    expect(screen.getByTestId("edit-section")).toBeTruthy();
  });

  it("is enabled and fully opaque at rest", () => {
    render(<RowTextButton {...baseProps} />);
    expect(screen.getByRole("button").props.accessibilityState).toEqual({ disabled: false });
    expect(resolvedStyle()[0].opacity).toBe(1);
  });

  it("dims to 0.5 when disabled", () => {
    render(<RowTextButton {...baseProps} disabled />);
    expect(resolvedStyle()[0].opacity).toBe(0.5);
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
    expect(resolvedStyle()[0].borderColor).toBe("#c00");
  });

  it("merges a caller-supplied style after its own", () => {
    render(<RowTextButton {...baseProps} style={{ marginLeft: 8 }} />);
    expect(resolvedStyle()[1]).toEqual({ marginLeft: 8 });
  });

  it("leaves the caller style slot empty when none is passed", () => {
    render(<RowTextButton {...baseProps} />);
    expect(resolvedStyle()[1]).toBeFalsy();
  });
});
