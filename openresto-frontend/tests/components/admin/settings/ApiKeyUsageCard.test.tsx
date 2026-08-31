import React from "react";
import { Linking, Platform } from "react-native";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ApiKeyUsageCard } from "@/components/admin/settings/ApiKeyUsageCard";
import type { Brand } from "@/types";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
const colorScheme = { current: "light" as "light" | "dark" };
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => colorScheme.current }));

const brand: { current: Brand } = {
  current: {
    appName: "Open Resto",
    primaryColor: "#0a7ea4",
    cliPackageUrl: "https://www.npmjs.com/package/openresto-cli",
    apiDocsUrl: "https://github.com/karanshukla/openresto/blob/main/docs/http-api.md",
    repositoryUrl: "https://github.com/karanshukla/openresto",
  },
};

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => brand.current,
}));

const palette = { borderColor: "#eee", mutedColor: "#888", cardBg: "#fff" };

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

describe("ApiKeyUsageCard", () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://bookings.example.com";
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    colorScheme.current = "light";
    brand.current = {
      appName: "Open Resto",
      primaryColor: "#0a7ea4",
      cliPackageUrl: "https://www.npmjs.com/package/openresto-cli",
      apiDocsUrl: "https://github.com/karanshukla/openresto/blob/main/docs/http-api.md",
      repositoryUrl: "https://github.com/karanshukla/openresto",
    };
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    jest.restoreAllMocks();
  });

  it("shows a curl example against this deployment's own API", () => {
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.getByTestId("api-key-curl-example").props.children).toBe(
      [
        'curl -H "X-API-Key: YOUR_KEY" \\',
        "  https://bookings.example.com/api/admin/api-keys/self",
      ].join("\n")
    );
  });

  it("shows a fetch example against this deployment's own API", () => {
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.getByTestId("api-key-fetch-example").props.children).toBe(
      [
        'const res = await fetch("https://bookings.example.com/api/admin/bookings", {',
        '  headers: { "X-API-Key": process.env.API_KEY },',
        "});",
      ].join("\n")
    );
  });

  it("names the header the key goes on", () => {
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.getByText(/X-API-Key header, never on Authorization/)).toBeTruthy();
  });

  it("opens each configured destination", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<ApiKeyUsageCard {...palette} />);

    fireEvent.press(screen.getByTestId("api-key-cli-link"));
    fireEvent.press(screen.getByTestId("api-key-docs-link"));
    fireEvent.press(screen.getByTestId("api-key-repo-link"));

    expect(openURL).toHaveBeenNthCalledWith(1, "https://www.npmjs.com/package/openresto-cli");
    expect(openURL).toHaveBeenNthCalledWith(
      2,
      "https://github.com/karanshukla/openresto/blob/main/docs/http-api.md"
    );
    expect(openURL).toHaveBeenNthCalledWith(3, "https://github.com/karanshukla/openresto");
  });

  it("offers only the destinations the server resolved", () => {
    brand.current = { ...brand.current, cliPackageUrl: undefined, apiDocsUrl: undefined };
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.queryByTestId("api-key-cli-link")).toBeNull();
    expect(screen.queryByTestId("api-key-docs-link")).toBeNull();
    expect(screen.getByTestId("api-key-repo-link")).toBeTruthy();
  });

  it("drops the links section when the server resolved none of them", () => {
    brand.current = {
      appName: "Open Resto",
      primaryColor: "#0a7ea4",
    };
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.queryByText("Learn more")).toBeNull();
    expect(screen.getByTestId("api-key-curl-example")).toBeTruthy();
  });

  it("copies the terminal example on web and confirms, then reverts", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy the terminal example to clipboard"));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("https://bookings.example.com/api/admin/api-keys/self")
    );
    await waitFor(() => expect(screen.getByLabelText("Terminal example copied")).toBeTruthy());
    await waitFor(
      () => expect(screen.getByLabelText("Copy the terminal example to clipboard")).toBeTruthy(),
      { timeout: 3000 }
    );
  });

  it("confirms only the example that was copied", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy the code example to clipboard"));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("process.env.API_KEY"));
    await waitFor(() => expect(screen.getByLabelText("Code example copied")).toBeTruthy());
    expect(screen.getByLabelText("Copy the terminal example to clipboard")).toBeTruthy();
  });

  it("keeps the second confirmation when the first example's timer expires", async () => {
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });
    jest.useFakeTimers();

    try {
      render(<ApiKeyUsageCard {...palette} />);
      fireEvent.press(screen.getByLabelText("Copy the terminal example to clipboard"));
      await act(async () => {});
      act(() => jest.advanceTimersByTime(1500));
      fireEvent.press(screen.getByLabelText("Copy the code example to clipboard"));
      await act(async () => {});

      // The terminal copy's own timer lands mid-confirmation for the code example, and must
      // clear only the confirmation it started.
      act(() => jest.advanceTimersByTime(700));

      expect(screen.getByLabelText("Code example copied")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not confirm the copy when the browser exposes no clipboard", async () => {
    setClipboard(undefined);

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy the terminal example to clipboard"));

    await waitFor(() =>
      expect(screen.getByText(/Select the example above and copy it manually/)).toBeTruthy()
    );
    expect(screen.queryByLabelText("Terminal example copied")).toBeNull();
  });

  it("does not confirm the copy when the clipboard write is rejected", async () => {
    setClipboard({ writeText: jest.fn().mockRejectedValue(new Error("NotAllowedError")) });

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy the code example to clipboard"));

    await waitFor(() =>
      expect(screen.getByText(/Select the example above and copy it manually/)).toBeTruthy()
    );
    expect(screen.queryByLabelText("Code example copied")).toBeNull();
  });

  it("reports the failure on the example that failed, leaving the other's caption alone", async () => {
    setClipboard(undefined);

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy the terminal example to clipboard"));

    await waitFor(() =>
      expect(screen.getByText(/Select the example above and copy it manually/)).toBeTruthy()
    );
    expect(screen.getByText(/Read the secret from an environment variable/)).toBeTruthy();
  });

  it("clears the failure once a later copy succeeds", async () => {
    const writeText = jest
      .fn()
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    setClipboard({ writeText });

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy the terminal example to clipboard"));
    await waitFor(() =>
      expect(screen.getByText(/Select the example above and copy it manually/)).toBeTruthy()
    );

    fireEvent.press(screen.getByLabelText("Copy the terminal example to clipboard"));

    await waitFor(() => expect(screen.getByLabelText("Terminal example copied")).toBeTruthy());
    expect(screen.queryByText(/Select the example above and copy it manually/)).toBeNull();
  });

  it("drops its pending confirmation timers on unmount", async () => {
    setClipboard({ writeText: jest.fn().mockResolvedValue(undefined) });
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    const view = render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy the terminal example to clipboard"));
    await waitFor(() => expect(screen.getByLabelText("Terminal example copied")).toBeTruthy());
    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("hides the copy buttons off web", () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    try {
      render(<ApiKeyUsageCard {...palette} />);
      expect(screen.queryByLabelText("Copy the terminal example to clipboard")).toBeNull();
      expect(screen.queryByLabelText("Copy the code example to clipboard")).toBeNull();
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    }
  });

  it("keeps the examples legible on the dark surface", () => {
    colorScheme.current = "dark";
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.getByTestId("api-key-curl-example")).toBeTruthy();
    expect(screen.getByTestId("api-key-fetch-example")).toBeTruthy();
  });

  it("collapses and expands the card", () => {
    render(<ApiKeyUsageCard {...palette} />);

    fireEvent.press(screen.getByLabelText("Using your keys"));

    expect(screen.getByLabelText("Using your keys").props.accessibilityState).toMatchObject({
      expanded: false,
    });
  });
});
