/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Platform, Text } from "react-native";
import { LocaleProvider, useLocale } from "@/context/LocaleContext";
import i18n from "@/i18n";
import { setActiveLocale } from "@/utils/locale";

// StorageService (and therefore localStorage["openresto.locale"]) only reads on web.
Object.defineProperty(Platform, "OS", { value: "web", configurable: true });

const mockGetLocales = jest.fn(() => [{ textDirection: "ltr" }]);
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

  it("falls through an unsupported brand.defaultLocale to DEFAULT_LOCALE", async () => {
    mockBrand = { defaultLocale: "not-a-real-locale" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(screen.getByTestId("locale").props.children).toBe("en"));
  });

  it("sets document.documentElement.lang and dir from expo-localization on web", async () => {
    mockGetLocales.mockReturnValue([{ textDirection: "ltr" }]);
    mockBrand = { defaultLocale: "fr" };

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(document.documentElement.lang).toBe("fr"));
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("defaults dir to ltr when expo-localization reports no locales", async () => {
    mockGetLocales.mockReturnValue([]);

    render(
      <LocaleProvider>
        <TestConsumer />
      </LocaleProvider>
    );

    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("useLocale defaults to DEFAULT_LOCALE outside a provider", () => {
    render(<TestConsumer />);
    expect(screen.getByTestId("locale").props.children).toBe("en");
  });
});
