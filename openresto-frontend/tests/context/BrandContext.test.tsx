import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { BrandProvider, useBrand } from "@/context/BrandContext";

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
      <Text testID="logo">{brand.logoUrl ?? "none"}</Text>
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
        logoUrl: "https://example.com/logo.png",
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
    expect(screen.getByTestId("logo").props.children).toBe("https://example.com/logo.png");

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
});
