/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { BrandProvider, useBrand } from "@/context/BrandContext";

jest.mock("@/utils/injectBrandFavicon", () => ({
  injectBrandFavicon: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation();
});

function TestConsumer() {
  const brand = useBrand();
  return (
    <>
      <Text testID="name">{brand.appName}</Text>
      <Text testID="color">{brand.primaryColor}</Text>
      <Text testID="accent">{brand.accentColor ?? "none"}</Text>
      <Text testID="logo">{brand.headerImageUrl ?? "none"}</Text>
      <Text testID="website">{brand.websiteUrl ?? "none"}</Text>
      <Text testID="copyright">{brand.copyrightText ?? "none"}</Text>
      <Text testID="instagram">{brand.socialLinks?.instagram ?? "none"}</Text>
    </>
  );
}

describe("BrandContext", () => {
  it("provides default brand values before fetch resolves", () => {
    // Fetch never resolves in this test
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    expect(screen.getByTestId("name").props.children).toBe("Open Resto");
    expect(screen.getByTestId("color").props.children).toBe("#0a7ea4");
  });

  it("fetches from /api/brand and updates context values", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appName: "My Custom Resto",
        primaryColor: "#ff5500",
        accentColor: "#00ff00",
        headerImageUrl: "https://example.com/hero.jpg",
      }),
    });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("name").props.children).toBe("My Custom Resto");
    });

    expect(screen.getByTestId("color").props.children).toBe("#ff5500");
    expect(screen.getByTestId("accent").props.children).toBe("#00ff00");
    expect(screen.getByTestId("logo").props.children).toBe("https://example.com/hero.jpg");

    expect(mockFetch.mock.calls[0][0]).toContain("/api/brand");
  });

  it("keeps defaults when fetch returns non-ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    // Wait for the effect to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("name").props.children).toBe("Open Resto");
    expect(screen.getByTestId("color").props.children).toBe("#0a7ea4");
  });

  it("keeps defaults when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("name").props.children).toBe("Open Resto");
    expect(screen.getByTestId("color").props.children).toBe("#0a7ea4");
  });

  it("falls back to defaults for missing fields in response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appName: "",
        primaryColor: "",
      }),
    });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Empty strings are falsy, so should fall back to defaults
    expect(screen.getByTestId("name").props.children).toBe("Open Resto");
    expect(screen.getByTestId("color").props.children).toBe("#0a7ea4");
    expect(screen.getByTestId("accent").props.children).toBe("none");
  });

  it("sets document title when it matches the default app name", async () => {
    document.title = "Open Resto";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appName: "My Resto", primaryColor: "#ff5500" }),
    });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("name").props.children).toBe("My Resto");
    });
    expect(document.title).toBe("My Resto");
    document.title = "";
  });

  it("does not override a custom document title", async () => {
    document.title = "My Custom App";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appName: "My Resto", primaryColor: "#ff5500" }),
    });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("name").props.children).toBe("My Resto");
    });
    expect(document.title).toBe("My Custom App");
    document.title = "";
  });

  it("buildEndpoint uses base URL when EXPO_PUBLIC_API_URL contains /api", async () => {
    const orig = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = "http://localhost:5062/api";
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:5062/api/brand");
    process.env.EXPO_PUBLIC_API_URL = orig;
  });

  it("exposes websiteUrl from API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appName: "My Resto",
        primaryColor: "#ff5500",
        websiteUrl: "https://bookings.example.com",
      }),
    });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("website").props.children).toBe("https://bookings.example.com");
    });
  });

  it("exposes copyrightText and socialLinks from API response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appName: "My Resto",
        primaryColor: "#ff5500",
        copyrightText: "© 2026 My Resto",
        socialLinks: { instagram: "https://instagram.com/resto" },
      }),
    });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("copyright").props.children).toBe("© 2026 My Resto");
    });
    expect(screen.getByTestId("instagram").props.children).toBe("https://instagram.com/resto");
  });

  it("buildEndpoint appends /api when EXPO_PUBLIC_API_URL has no /api", async () => {
    const orig = process.env.EXPO_PUBLIC_API_URL;
    process.env.EXPO_PUBLIC_API_URL = "http://localhost:5062";
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(
      <BrandProvider>
        <TestConsumer />
      </BrandProvider>
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockFetch.mock.calls[0][0]).toBe("http://localhost:5062/api/brand");
    process.env.EXPO_PUBLIC_API_URL = orig;
  });
});
