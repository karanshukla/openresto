/**
 * @jest-environment jsdom
 */
import React from "react";
import { Platform } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { EmbedSnippetCard, embedSnippets } from "@/components/admin/settings/EmbedSnippetCard";
import { fetchRestaurants } from "@/api/restaurants";
import type { Brand } from "@/types";

jest.mock("@/api/restaurants", () => ({ fetchRestaurants: jest.fn() }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }) as Brand,
}));
jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = { borderColor: "#ddd", mutedColor: "#888", cardBg: "#fff" };
const originalOS = Platform.OS;

describe("embedSnippets", () => {
  it("names the server and the picked location", () => {
    expect(embedSnippets("https://book.example/", 3)).toEqual({
      script: '<script src="https://book.example/embed.js" data-location="3"></script>',
      link: '<a href="https://book.example/embed?location=3" target="_blank">Book a table</a>',
    });
  });

  it("leaves the location out for all locations", () => {
    expect(embedSnippets("https://book.example", 0)).toEqual({
      script: '<script src="https://book.example/embed.js"></script>',
      link: '<a href="https://book.example/embed" target="_blank">Book a table</a>',
    });
  });
});

describe("EmbedSnippetCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    (fetchRestaurants as jest.Mock).mockResolvedValue([{ id: 3, name: "Harbour" }]);
    Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
  });

  it("fills the snippet in with this page's origin and the picked location", async () => {
    render(<EmbedSnippetCard {...baseProps} />);
    const script = () => screen.getByTestId("embed-snippet-script").props.children as string;
    expect(script()).toBe(`<script src="${window.location.origin}/embed.js"></script>`);

    fireEvent.press(screen.getByLabelText("Location, All locations"));
    fireEvent.press(await screen.findByText("Harbour"));

    await waitFor(() => expect(script()).toContain('data-location="3"'));
  });

  it("confirms a copy only once the clipboard write landed", async () => {
    jest.useFakeTimers();
    render(<EmbedSnippetCard {...baseProps} />);

    await act(async () => fireEvent.press(screen.getByTestId("embed-snippet-link-copy")));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `<a href="${window.location.origin}/embed" target="_blank">Book a table</a>`
    );
    expect(screen.getByText("Copied")).toBeTruthy();
    act(() => jest.runAllTimers());
    expect(screen.queryByText("Copied")).toBeNull();

    (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error("denied"));
    await act(async () => fireEvent.press(screen.getByTestId("embed-snippet-script-copy")));
    expect(screen.queryByText("Copied")).toBeNull();
    jest.useRealTimers();
  });

  it("collapses", () => {
    render(<EmbedSnippetCard {...baseProps} />);
    fireEvent.press(screen.getByText("Snippet"));
    expect(fetchRestaurants).toHaveBeenCalled();
  });
});
