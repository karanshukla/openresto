/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { parseLinkedText, LinkedText } from "@/components/common/LinkedText";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
  usePathname: jest.fn(() => "/"),
}));

describe("parseLinkedText", () => {
  it("returns a single plain-text segment for text without links", () => {
    expect(parseLinkedText("Hello world")).toEqual([{ text: "Hello world" }]);
  });

  it("parses a single inline link", () => {
    expect(parseLinkedText("see [menu](https://e.com)")).toEqual([
      { text: "see " },
      { text: "menu", url: "https://e.com" },
    ]);
  });

  it("parses multiple inline links", () => {
    expect(parseLinkedText("[x](u1) and [y](u2)")).toEqual([
      { text: "x", url: "u1" },
      { text: " and " },
      { text: "y", url: "u2" },
    ]);
  });

  it("passes unmatched brackets through as plain text", () => {
    expect(parseLinkedText("a [broken]( link")).toEqual([{ text: "a [broken]( link" }]);
    expect(parseLinkedText("just [a bracket")).toEqual([{ text: "just [a bracket" }]);
  });

  it("handles an empty string", () => {
    expect(parseLinkedText("")).toEqual([{ text: "" }]);
  });

  it("does not carry lastIndex state across calls (fresh regex per call)", () => {
    // Calling twice must produce identical results — a stateful g-flag regex would drift.
    expect(parseLinkedText("[a](b)")).toEqual([{ text: "a", url: "b" }]);
    expect(parseLinkedText("[a](b)")).toEqual([{ text: "a", url: "b" }]);
  });
});

describe("LinkedText component", () => {
  it("renders plain text with no link affordance", () => {
    renderWithProviders(<LinkedText text="Just plain copy." />);
    expect(screen.getByText("Just plain copy.")).toBeTruthy();
    expect(screen.queryByLabelText("http://anything")).toBeNull();
  });

  it("renders a tappable link for matched [label](url)", () => {
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);

    renderWithProviders(<LinkedText text="See our [menu](https://example.com/menu)." />);

    expect(screen.getByText("menu")).toBeTruthy();
    // The Pressable carries the url as its accessibilityHint.
    const link = screen.getByA11yHint("https://example.com/menu");
    fireEvent.press(link);
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
    openURLSpy.mockRestore();
  });

  it("renders multiple links and text runs together", () => {
    renderWithProviders(<LinkedText text="[menu](https://e.com/m) and [book](https://e.com/b)" />);
    expect(screen.getByText("menu")).toBeTruthy();
    expect(screen.getByText("book")).toBeTruthy();
    expect(screen.getByText(" and ")).toBeTruthy();
  });
});
