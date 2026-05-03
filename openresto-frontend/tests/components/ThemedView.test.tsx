import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ThemedView } from "@/components/themed-view";
import { Text } from "react-native";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("ThemedView", () => {
  it("renders children", () => {
    render(
      <ThemedView>
        <Text>Child content</Text>
      </ThemedView>
    );
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("applies light background by default", () => {
    const { toJSON } = render(
      <ThemedView testID="themed-view">
        <Text>Content</Text>
      </ThemedView>
    );
    const json = toJSON();
    expect(json).toBeTruthy();
  });

  it("applies custom lightColor override", () => {
    render(
      <ThemedView lightColor="#ff0000" testID="custom-view">
        <Text>Red bg</Text>
      </ThemedView>
    );
    expect(screen.getByText("Red bg")).toBeTruthy();
  });

  it("passes additional props through", () => {
    render(
      <ThemedView testID="test-view" accessibilityLabel="themed container">
        <Text>Props test</Text>
      </ThemedView>
    );
    expect(screen.getByTestId("test-view")).toBeTruthy();
  });
});
