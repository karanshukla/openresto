/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import NotFoundScreen from "@/app/+not-found";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

jest.mock("expo-router", () => ({
  usePathname: jest.fn(() => "/some/missing/page"),
  Link: ({ children, href, style }: any) =>
    require("react").createElement("Text", { style }, children),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("NotFoundScreen", () => {
  const renderScreen = () =>
    render(
      <AppThemeProvider>
        <BrandProvider>
          <NotFoundScreen />
        </BrandProvider>
      </AppThemeProvider>
    );

  it("renders 404 code", () => {
    renderScreen();
    expect(screen.getByText("404")).toBeTruthy();
  });

  it("renders page not found title", () => {
    renderScreen();
    expect(screen.getByText("Page not found")).toBeTruthy();
  });

  it("renders the current pathname", () => {
    renderScreen();
    expect(screen.getByText("/some/missing/page")).toBeTruthy();
  });

  it("renders Go to home link", () => {
    renderScreen();
    expect(screen.getByText("Go to home")).toBeTruthy();
  });
});
