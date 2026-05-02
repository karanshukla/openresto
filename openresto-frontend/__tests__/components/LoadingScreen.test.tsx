import React from "react";
import { render, screen } from "@testing-library/react-native";
import LoadingScreen from "@/components/common/LoadingScreen";
import { BrandProvider } from "@/context/BrandContext";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("LoadingScreen", () => {
  it("renders message and brand in test mode", () => {
    const mockBrand = { appName: "Test App", primaryColor: "#000" };
    render(
      <BrandProvider>
        <LoadingScreen brand={mockBrand} message="Test Loading..." />
      </BrandProvider>
    );
    expect(screen.getByText("Test Loading...")).toBeTruthy();
    expect(screen.getByText("Test App")).toBeTruthy();
  });
});
