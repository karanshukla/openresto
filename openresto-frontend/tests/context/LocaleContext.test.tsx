/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform, Text } from "react-native";
import { LocaleProvider, useLocale } from "@/context/LocaleContext";
import i18n from "@/i18n";
import { setActiveLocale } from "@/utils/locale";
import { LOCALE_DIRECTIONS } from "@/constants/locales";

// StorageService (and therefore localStorage["openresto.locale"]) only reads on web.
Object.defineProperty(Platform, "OS", { value: "web", configurable: true });

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
  const { locale, setLocale } = useLocale();
  return (
    <>
      <Text testID="locale">{locale}</Text>
      <Text testID="switch-to-fr" onPress={() => setLocale("fr")}>
        switch
      </Text>
    </>
  );
}

describe("LocaleContext", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    mockGetLocales.mockReturnValue([{ textDirection: "ltr" }]);
    mockBrand = {};
    document.documentElement.lang = "";
    document.documentElement.dir = "";
    jest.spyOn(i18n, "changeLanguage").mockResolvedValue(undefined as never);
  });

  it("falls back to DEFAULT_LOCALE when nothing else resolves", async () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("en"));
    expect(i18n.changeLanguage).toHaveBeenCalledWith("en");
    expect(setActiveLocale).toHaveBeenCalledWith("en");
  });

  it("resolves brand.defaultLocale when localStorage has no saved pick", async () => {
    mockBrand = { defaultLocale: "es" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("es"));
    expect(i18n.changeLanguage).toHaveBeenCalledWith("es");
    expect(setActiveLocale).toHaveBeenCalledWith("es");
  });

  it("prefers a supported localStorage pick over brand.defaultLocale", async () => {
    localStorage.setItem("openresto.locale", "fr");
    mockBrand = { defaultLocale: "es" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("fr"));
    expect(i18n.changeLanguage).toHaveBeenCalledWith("fr");
  });

  it("falls through an unsupported localStorage value to brand.defaultLocale", async () => {
    localStorage.setItem("openresto.locale", "xx-not-a-locale");
    mockBrand = { defaultLocale: "de" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("de"));
  });

  it("ignores the device language on web, where the restaurant's own default wins", async () => {
    // The mirror of this case is in LocaleContext.native.test.tsx, where the device wins.
    mockGetLocales.mockReturnValue([{ languageCode: "fr", textDirection: "ltr" }]);
    mockBrand = { defaultLocale: "es" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("es"));
  });

  it("falls through an unsupported brand.defaultLocale to DEFAULT_LOCALE", async () => {
    mockBrand = { defaultLocale: "not-a-real-locale" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("en"));
  });

  it("sets document.documentElement.lang and dir from the active locale on web", async () => {
    mockBrand = { defaultLocale: "fr" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(document.documentElement.lang).toBe("fr"));
    expect(document.documentElement.dir).toBe(LOCALE_DIRECTIONS.fr);
  });

  it("takes dir from the chosen locale, not from an RTL device", async () => {
    mockGetLocales.mockReturnValue([{ textDirection: "rtl" }]);
    mockBrand = { defaultLocale: "de" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(document.documentElement.lang).toBe("de"));
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("useLocale defaults to DEFAULT_LOCALE outside a provider", () => {
    render(<TestConsumer />);
    expect(screen.getByTestId("locale").props.children).toBe("en");
  });

  it("setLocale updates the context live, persists the pick, and re-applies i18next/formatters", async () => {
    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );
    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("en"));
    jest.clearAllMocks();

    fireEvent.press(screen.getByTestId("switch-to-fr"));

    expect(screen.getByTestId("locale").props.children).toBe("fr");
    expect(localStorage.getItem("openresto.locale")).toBe("fr");
    expect(i18n.changeLanguage).toHaveBeenCalledWith("fr");
    expect(setActiveLocale).toHaveBeenCalledWith("fr");
    expect(document.documentElement.lang).toBe("fr");
  });
});
