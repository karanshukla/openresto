import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ScrollView, StyleSheet, Text } from "react-native";
import { ModalCard } from "@/components/common/ModalCard";

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { card: "#fff", border: "#ccc" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

const card = () =>
  render(
    <ModalCard visible title="Settings" onDismiss={jest.fn()} testID="modal">
      <Text>row</Text>
    </ModalCard>
  );

/**
 * Without a ceiling the card is as tall as whatever it holds, so a long dialog stops reading
 * as a dialog and becomes the screen — and its last rows, the close button included, sit past
 * the bottom edge with no way to reach them. The guest settings sheet grew past the viewport
 * exactly this way once it took on what the web footer used to carry.
 */
describe("ModalCard height", () => {
  it("caps the card rather than letting it grow past the viewport", () => {
    card();
    const style = StyleSheet.flatten(screen.getByLabelText("Settings").props.style);
    expect(style.maxHeight).toBe("85%");
  });

  it("lets the body shrink inside that cap instead of pushing it taller", () => {
    card();
    const body = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.style);
    expect(body.flexShrink).toBe(1);
  });

  it("still renders what it was given", () => {
    card();
    expect(screen.getByText("row")).toBeTruthy();
  });
});
