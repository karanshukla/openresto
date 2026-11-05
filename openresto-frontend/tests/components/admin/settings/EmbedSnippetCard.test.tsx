/**
 * @jest-environment jsdom
 */
import React from "react";
import { Platform } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { EmbedSnippetCard, embedSnippets } from "@/components/admin/settings/EmbedSnippetCard";
import { fetchRestaurants } from "@/api/restaurants";
import { probeEmbed } from "@/utils/embedProbe";
import type { Brand } from "@/types";

jest.mock("@/api/restaurants", () => ({ fetchRestaurants: jest.fn() }));
jest.mock("@/utils/embedProbe", () => ({ probeEmbed: jest.fn() }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }) as Brand,
}));
jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
  origins: ["https://bistro.example"],
};
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
    (probeEmbed as jest.Mock).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
  });

  it("fills the snippet in with this page's origin and the picked location", async () => {
    render(<EmbedSnippetCard {...baseProps} />);
    await screen.findByTestId("embed-probe-ok");
    const script = () => screen.getByTestId("embed-snippet-script").props.children as string;
    expect(script()).toBe(`<script src="${window.location.origin}/embed.js"></script>`);

    fireEvent.press(screen.getByLabelText("Location, All locations"));
    fireEvent.press(await screen.findByText("Harbour"));

    await waitFor(() => expect(script()).toContain('data-location="3"'));
  });

  it("confirms a copy only once the clipboard write landed", async () => {
    render(<EmbedSnippetCard {...baseProps} />);
    await screen.findByTestId("embed-probe-ok");
    jest.useFakeTimers();

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

  it("withholds the script and says why while the proxy is misconfigured", async () => {
    (probeEmbed as jest.Mock).mockResolvedValue({ ok: false, problem: "frameOptions" });
    render(<EmbedSnippetCard {...baseProps} />);

    expect(await screen.findByText(/sends X-Frame-Options on \/embed/)).toBeTruthy();
    expect(screen.queryByTestId("embed-snippet-script")).toBeNull();
    // A plain link opens /embed at the top level, so no framing header can break it.
    expect(screen.getByTestId("embed-snippet-link")).toBeTruthy();

    (probeEmbed as jest.Mock).mockResolvedValue({ ok: true });
    fireEvent.press(screen.getByTestId("embed-probe-recheck"));
    expect(await screen.findByTestId("embed-snippet-script")).toBeTruthy();
    expect(probeEmbed).toHaveBeenCalledTimes(2);
  });

  it("asks for an allowed site first, with nothing to re-check", async () => {
    (probeEmbed as jest.Mock).mockResolvedValue({ ok: false, problem: "noOrigins" });
    render(<EmbedSnippetCard {...baseProps} origins={[]} />);

    expect(await screen.findByText("Add an allowed site to get the widget snippet.")).toBeTruthy();
    expect(screen.queryByTestId("embed-probe-recheck")).toBeNull();
  });

  it("waits for the allowed sites before probing", () => {
    render(<EmbedSnippetCard {...baseProps} origins={null} />);
    expect(screen.getByTestId("embed-probe-checking")).toBeTruthy();
    expect(probeEmbed).not.toHaveBeenCalled();
  });

  it("re-probes when the allowed sites change, ignoring the stale answer", async () => {
    let resolveFirst: (r: unknown) => void = () => {};
    (probeEmbed as jest.Mock)
      .mockReturnValueOnce(new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ ok: true });
    const { rerender } = render(<EmbedSnippetCard {...baseProps} />);
    rerender(<EmbedSnippetCard {...baseProps} origins={["https://other.example"]} />);

    expect(await screen.findByTestId("embed-probe-ok")).toBeTruthy();
    await act(async () => resolveFirst({ ok: false, problem: "unreachable" }));
    expect(screen.getByTestId("embed-probe-ok")).toBeTruthy();
    expect(probeEmbed).toHaveBeenLastCalledWith(["https://other.example"]);
  });

  it("collapses", () => {
    render(<EmbedSnippetCard {...baseProps} />);
    fireEvent.press(screen.getByText("Snippet"));
    expect(fetchRestaurants).toHaveBeenCalled();
  });
});
