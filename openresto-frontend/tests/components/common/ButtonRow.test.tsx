import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text, type ViewStyle } from "react-native";
import { ButtonRow } from "@/components/common/ButtonRow";

const rowStyle = (testID = "row") =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style) as ViewStyle;

describe("ButtonRow", () => {
  it("renders its children", () => {
    render(
      <ButtonRow testID="row">
        <Text>Cancel</Text>
        <Text>Save</Text>
      </ButtonRow>
    );
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("closes a form by right-aligning its cluster", () => {
    render(
      <ButtonRow testID="row">
        <Text>Save</Text>
      </ButtonRow>
    );
    expect(rowStyle().justifyContent).toBe("flex-end");
  });

  it("left-aligns a standing CTA", () => {
    render(
      <ButtonRow testID="row" align="start">
        <Text>Add user</Text>
      </ButtonRow>
    );
    expect(rowStyle().justifyContent).toBe("flex-start");
  });

  it("splits a status line from its action", () => {
    render(
      <ButtonRow testID="row" align="between">
        <Text>Unsaved changes</Text>
        <Text>Save</Text>
      </ButtonRow>
    );
    expect(rowStyle().justifyContent).toBe("space-between");
  });

  /**
   * The wrap is what lets the cluster live in a card of any width without a breakpoint: too
   * narrow and it drops to a second line rather than squeezing one button into the other.
   */
  it("wraps rather than shrinking its buttons", () => {
    render(
      <ButtonRow testID="row">
        <Text>Save</Text>
      </ButtonRow>
    );
    expect(rowStyle().flexWrap).toBe("wrap");
    expect(rowStyle().flexDirection).toBe("row");
  });

  it("merges a caller-supplied style over its own", () => {
    render(
      <ButtonRow testID="row" style={{ marginTop: 24 }}>
        <Text>Save</Text>
      </ButtonRow>
    );
    expect(rowStyle().marginTop).toBe(24);
  });
});
