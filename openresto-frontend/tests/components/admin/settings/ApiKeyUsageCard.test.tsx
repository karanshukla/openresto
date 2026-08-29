import React from "react";
import { Linking, Platform } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
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

  it("names the header the key goes on", () => {
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.getByText(/X-API-Key header, not Authorization/)).toBeTruthy();
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

  it("copies the example on web and confirms, then reverts", async () => {
    const writeText = jest.fn();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy example request to clipboard"));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("https://bookings.example.com/api/admin/api-keys/self")
    );
    await waitFor(() => expect(screen.getByLabelText("Example request copied")).toBeTruthy());
    await waitFor(
      () => expect(screen.getByLabelText("Copy example request to clipboard")).toBeTruthy(),
      { timeout: 3000 }
    );
  });

  it("still confirms the copy when the browser exposes no clipboard", () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });

    render(<ApiKeyUsageCard {...palette} />);
    fireEvent.press(screen.getByLabelText("Copy example request to clipboard"));

    expect(screen.getByLabelText("Example request copied")).toBeTruthy();
  });

  it("hides the copy button off web", () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    try {
      render(<ApiKeyUsageCard {...palette} />);
      expect(screen.queryByLabelText("Copy example request to clipboard")).toBeNull();
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    }
  });

  it("keeps the example legible on the dark surface", () => {
    colorScheme.current = "dark";
    render(<ApiKeyUsageCard {...palette} />);

    expect(screen.getByTestId("api-key-curl-example")).toBeTruthy();
  });

  it("collapses and expands the card", () => {
    render(<ApiKeyUsageCard {...palette} />);

    fireEvent.press(screen.getByLabelText("Using your keys"));

    expect(screen.getByLabelText("Using your keys").props.accessibilityState).toMatchObject({
      expanded: false,
    });
  });
});
