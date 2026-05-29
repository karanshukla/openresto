import React from "react";
import { render, screen } from "@testing-library/react-native";
import LoadingScreen from "@/components/common/LoadingScreen";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };

describe("LoadingScreen", () => {
  it("renders test-mode fallback with default message", () => {
    render(<LoadingScreen brand={brand} />);
    expect(screen.getByTestId("loading-screen")).toBeTruthy();
    expect(screen.getByText("Preparing your table...")).toBeTruthy();
    expect(screen.getByText("Open Resto")).toBeTruthy();
  });

  it("renders custom message", () => {
    render(<LoadingScreen brand={brand} message="Loading menu..." />);
    expect(screen.getByText("Loading menu...")).toBeTruthy();
  });
});
