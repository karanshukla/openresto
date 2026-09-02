/**
 * @jest-environment jsdom
 */
import React from "react";
import { Platform } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import WalletActions from "@/components/booking/WalletActions";
import { useBrand } from "@/context/BrandContext";
import { fetchGoogleWalletSaveUrl } from "@/api/wallet";
import { deliverApplePass, openGoogleWalletSave } from "@/utils/wallet";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/context/BrandContext", () => {
  const actual = jest.requireActual("@/context/BrandContext");
  return { ...actual, useBrand: jest.fn() };
});
jest.mock("@/api/wallet", () => ({
  appleWalletPassUrl: (ref: string, email: string) => `/pkpass/${ref}/${email}`,
  fetchGoogleWalletSaveUrl: jest.fn(),
}));
jest.mock("@/utils/wallet", () => ({
  deliverApplePass: jest.fn(),
  openGoogleWalletSave: jest.fn(),
}));

Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

const brand = useBrand as jest.Mock;
const google = fetchGoogleWalletSaveUrl as jest.Mock;
const apple = deliverApplePass as jest.Mock;

const onPlatform = (os: string, body: () => void) => {
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });
  try {
    body();
  } finally {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
  }
};

function renderWallet(wallet?: { apple: boolean; google: boolean }) {
  brand.mockReturnValue({ appName: "Open Resto", primaryColor: "#0a7ea4", wallet });
  return renderWithProviders(<WalletActions bookingRef="ref-1" email="x@y.z" separator={<></>} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  apple.mockResolvedValue(undefined);
});

describe("WalletActions", () => {
  it("renders nothing when the server issues no passes", () => {
    renderWallet(undefined);
    expect(screen.queryByTestId("wallet-actions")).toBeNull();
    renderWallet({ apple: false, google: false });
    expect(screen.queryByTestId("wallet-actions")).toBeNull();
  });

  it("offers both configured passes on web", () => {
    renderWallet({ apple: true, google: true });
    expect(screen.getByText("ADD TO WALLET")).toBeTruthy();
    expect(screen.getByTestId("wallet-apple-btn")).toBeTruthy();
    expect(screen.getByTestId("wallet-google-btn")).toBeTruthy();
  });

  it("offers only the platform's own wallet on a phone", () => {
    onPlatform("ios", () => {
      renderWallet({ apple: true, google: true });
      expect(screen.getByTestId("wallet-apple-btn")).toBeTruthy();
      expect(screen.queryByTestId("wallet-google-btn")).toBeNull();
    });
    onPlatform("android", () => {
      renderWallet({ apple: true, google: true });
      expect(screen.queryByTestId("wallet-apple-btn")).toBeNull();
      expect(screen.getByTestId("wallet-google-btn")).toBeTruthy();
    });
  });

  it("renders nothing on a phone whose own wallet is not configured", () => {
    onPlatform("android", () => {
      renderWallet({ apple: true, google: false });
      expect(screen.queryByTestId("wallet-actions")).toBeNull();
    });
  });

  it("hands the pkpass URL to the platform delivery on Apple", async () => {
    renderWallet({ apple: true, google: false });
    fireEvent.press(screen.getByTestId("wallet-apple-btn"));
    await waitFor(() => expect(apple).toHaveBeenCalledWith("/pkpass/ref-1/x@y.z", "ref-1"));
    expect(screen.queryByText(/Couldn't prepare the pass/)).toBeNull();
  });

  it("explains when the Apple pass could not be delivered", async () => {
    apple.mockRejectedValue(new Error("no wallet"));
    renderWallet({ apple: true, google: false });
    fireEvent.press(screen.getByTestId("wallet-apple-btn"));
    expect(await screen.findByText(/Couldn't prepare the pass/)).toBeTruthy();
  });

  it("fetches the Google save link and opens it", async () => {
    google.mockResolvedValue("https://pay.google.com/gp/v/save/jwt");
    renderWallet({ apple: false, google: true });
    fireEvent.press(screen.getByTestId("wallet-google-btn"));
    await waitFor(() =>
      expect(openGoogleWalletSave).toHaveBeenCalledWith("https://pay.google.com/gp/v/save/jwt")
    );
    expect(google).toHaveBeenCalledWith("ref-1", "x@y.z");
  });

  it("explains when no Google save link came back", async () => {
    google.mockResolvedValue(null);
    renderWallet({ apple: false, google: true });
    fireEvent.press(screen.getByTestId("wallet-google-btn"));
    expect(await screen.findByText(/Couldn't prepare the pass/)).toBeTruthy();
    expect(openGoogleWalletSave).not.toHaveBeenCalled();
  });
});
