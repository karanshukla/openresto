/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { Linking, Platform, StyleSheet, type ViewStyle } from "react-native";
import DirectionsActions from "@/components/booking/DirectionsActions";
import { VENDOR_BRANDS } from "@/constants/vendorBrands";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

/** jest-expo defaults Platform.OS to "ios"; the two-pill rules below are web rules. */
Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

const onPlatform = (os: string, body: () => void) => {
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });
  try {
    body();
  } finally {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
  }
};

describe("DirectionsActions", () => {
  it("renders named Google/Apple buttons under GET DIRECTIONS", () => {
    renderWithProviders(<DirectionsActions address="123 Main St" />);
    expect(screen.getByText("GET DIRECTIONS")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Apple")).toBeTruthy();
  });

  it("names both buttons for screen readers", () => {
    renderWithProviders(<DirectionsActions address="123 Main St" />);
    expect(screen.getByLabelText("Google")).toBeTruthy();
    expect(screen.getByLabelText("Apple")).toBeTruthy();
  });

  it("gives Google its brand colour and leaves Apple's achromatic mark neutral", () => {
    renderWithProviders(<DirectionsActions address="123 Main St" />);
    const borderOf = (testID: string) =>
      (StyleSheet.flatten(screen.getByTestId(testID).props.style) as ViewStyle).borderColor;

    expect(borderOf("maps-google-btn")).toBe(VENDOR_BRANDS.google);
    expect(borderOf("maps-apple-btn")).not.toBe(VENDOR_BRANDS.google);
  });

  it("opens Google Maps with the encoded address", () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    renderWithProviders(<DirectionsActions address="123 Main St" />);
    fireEvent.press(screen.getByTestId("maps-google-btn"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.google.com/?q=123%20Main%20St");
    openURLSpy.mockRestore();
  });

  it("opens Apple Maps with the encoded address", () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    renderWithProviders(<DirectionsActions address="123 Main St" />);
    fireEvent.press(screen.getByTestId("maps-apple-btn"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.apple.com/?q=123%20Main%20St");
    openURLSpy.mockRestore();
  });

  it("opens both services from their labels", () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    renderWithProviders(<DirectionsActions address="456 Ocean Ave" />);
    fireEvent.press(screen.getByText("Google"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.google.com/?q=456%20Ocean%20Ave");
    fireEvent.press(screen.getByText("Apple"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.apple.com/?q=456%20Ocean%20Ave");
    openURLSpy.mockRestore();
  });

  /**
   * A phone already has a maps app, so off web there is one pill that opens it rather than a
   * choice between two services one of which the device may not have.
   */
  describe("off web", () => {
    it("offers one pill under the same heading, and neither service by name", () => {
      onPlatform("ios", () => {
        renderWithProviders(<DirectionsActions address="123 Main St" />);
        expect(screen.getByText("GET DIRECTIONS")).toBeTruthy();
        expect(screen.getByText("Open in Maps")).toBeTruthy();
        expect(screen.queryByText("Google")).toBeNull();
        expect(screen.queryByText("Apple")).toBeNull();
      });
    });

    it("hands iOS to Apple Maps", () => {
      onPlatform("ios", () => {
        const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
        renderWithProviders(<DirectionsActions address="123 Main St" />);
        fireEvent.press(screen.getByTestId("maps-open-btn"));
        expect(openURLSpy).toHaveBeenCalledWith("https://maps.apple.com/?q=123%20Main%20St");
        openURLSpy.mockRestore();
      });
    });

    it("hands Android to Google Maps", () => {
      onPlatform("android", () => {
        const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
        renderWithProviders(<DirectionsActions address="123 Main St" />);
        fireEvent.press(screen.getByTestId("maps-open-btn"));
        expect(openURLSpy).toHaveBeenCalledWith("https://maps.google.com/?q=123%20Main%20St");
        openURLSpy.mockRestore();
      });
    });
  });
});
