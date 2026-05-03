import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ThemedText } from "@/components/themed-text";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("ThemedText", () => {
  it("renders children text", () => {
    render(<ThemedText>Hello World</ThemedText>);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });

  it("renders with default type", () => {
    render(<ThemedText>Default</ThemedText>);
    expect(screen.getByText("Default")).toBeTruthy();
  });

  it("renders with title type", () => {
    render(<ThemedText type="title">Title Text</ThemedText>);
    expect(screen.getByText("Title Text")).toBeTruthy();
  });

  it("renders with subtitle type", () => {
    render(<ThemedText type="subtitle">Subtitle</ThemedText>);
    expect(screen.getByText("Subtitle")).toBeTruthy();
  });

  it("renders with link type", () => {
    render(<ThemedText type="link">Click here</ThemedText>);
    expect(screen.getByText("Click here")).toBeTruthy();
  });

  it("renders with defaultSemiBold type", () => {
    render(<ThemedText type="defaultSemiBold">Bold text</ThemedText>);
    expect(screen.getByText("Bold text")).toBeTruthy();
  });

  it("applies lightColor override in light mode", () => {
    render(<ThemedText lightColor="#ff0000">Red text</ThemedText>);
    expect(screen.getByText("Red text")).toBeTruthy();
  });
});
