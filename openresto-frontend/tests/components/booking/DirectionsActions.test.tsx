/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";
import DirectionsActions from "@/components/booking/DirectionsActions";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

describe("DirectionsActions", () => {
  it("renders an icon strip labelled MAPS when compact", () => {
    renderWithProviders(<DirectionsActions address="123 Main St" compact />);
    expect(screen.getByText("GET DIRECTIONS")).toBeTruthy();
    expect(screen.getByLabelText("Open in Google Maps")).toBeTruthy();
    expect(screen.getByLabelText("Open in Apple Maps")).toBeTruthy();
  });

  it("renders labelled Google/Apple buttons under GET DIRECTIONS when wide", () => {
    renderWithProviders(<DirectionsActions address="123 Main St" compact={false} />);
    expect(screen.getByText("GET DIRECTIONS")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Apple")).toBeTruthy();
  });

  it("opens Google Maps with the encoded address, compact", () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    renderWithProviders(<DirectionsActions address="123 Main St" compact />);
    fireEvent.press(screen.getByTestId("maps-google-btn"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.google.com/?q=123%20Main%20St");
    openURLSpy.mockRestore();
  });

  it("opens Apple Maps with the encoded address, compact", () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    renderWithProviders(<DirectionsActions address="123 Main St" compact />);
    fireEvent.press(screen.getByTestId("maps-apple-btn"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.apple.com/?q=123%20Main%20St");
    openURLSpy.mockRestore();
  });

  it("opens Google/Apple Maps from the wide labelled buttons", () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    renderWithProviders(<DirectionsActions address="456 Ocean Ave" compact={false} />);
    fireEvent.press(screen.getByText("Google"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.google.com/?q=456%20Ocean%20Ave");
    fireEvent.press(screen.getByText("Apple"));
    expect(openURLSpy).toHaveBeenCalledWith("https://maps.apple.com/?q=456%20Ocean%20Ave");
    openURLSpy.mockRestore();
  });

  it("works on native (Linking.openURL isn't a web-only API)", () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    renderWithProviders(<DirectionsActions address="123 Main St" compact />);
    fireEvent.press(screen.getByTestId("maps-google-btn"));
    expect(openURLSpy).toHaveBeenCalled();

    openURLSpy.mockRestore();
    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
  });
});
