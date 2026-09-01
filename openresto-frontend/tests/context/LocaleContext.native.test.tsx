/**
 * @jest-environment jsdom
 *
 * Covers the device-locale step of `resolveLocale`, which only exists off web: an installed
 * app follows the phone's language, a website follows the restaurant's. The web order is
 * pinned in `LocaleContext.test.tsx`, and Platform.OS is per-file, so the two are two files.
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Platform, Text } from "react-native";
import { LocaleProvider, useLocale } from "@/context/LocaleContext";
import i18n from "@/i18n";
import { setActiveLocale } from "@/utils/locale";

Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });

const mockGetLocales = jest.fn<{ languageCode?: string; textDirection: string }[], []>(() => [
  { textDirection: "ltr" },
]);
jest.mock("expo-localization", () => ({
  getLocales: () => mockGetLocales(),
}));

let mockBrand: { defaultLocale?: string } = {};
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrand,
}));

jest.mock("@/utils/locale", () => ({
  setActiveLocale: jest.fn(),
}));

function TestConsumer() {
  const { locale } = useLocale();
  return <Text testID="locale">{locale}</Text>;
}

const renderProvider = () =>
  render(
    <LocaleProvider>
      <TestConsumer />
    </LocaleProvider>
  );

describe("LocaleContext on a device", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrand = {};
    jest.spyOn(i18n, "changeLanguage").mockResolvedValue(undefined as never);
  });

  it("follows the phone's language over the restaurant's default", async () => {
    mockGetLocales.mockReturnValue([{ languageCode: "fr", textDirection: "ltr" }]);
    mockBrand = { defaultLocale: "es" };

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("fr"));
    expect(setActiveLocale).toHaveBeenCalledWith("fr");
  });

  it("falls through a language this app does not ship to the restaurant's default", async () => {
    mockGetLocales.mockReturnValue([{ languageCode: "ja", textDirection: "ltr" }]);
    mockBrand = { defaultLocale: "de" };

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("de"));
  });

  it("falls back to DEFAULT_LOCALE when neither the device nor the brand names one", async () => {
    renderProvider();

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("en"));
  });
});
