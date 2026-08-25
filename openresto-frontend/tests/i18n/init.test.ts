import i18n from "@/i18n";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/constants/locales";

describe("i18n/index", () => {
  afterEach(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it("initializes with every supported locale bundled as a resource", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(i18n.hasResourceBundle(locale, "translation")).toBe(true);
    }
  });

  it("falls back to DEFAULT_LOCALE", () => {
    expect(i18n.options.fallbackLng).toEqual([DEFAULT_LOCALE]);
  });

  it("does not escape interpolated values (React/RN already escapes on render)", () => {
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
  });

  it("resolves the end-to-end extracted key on the default language", () => {
    expect(i18n.t("restaurant.home.locationsHeading")).toBe("Our locations");
  });

  it("re-renders through the same key in another supported language on changeLanguage", async () => {
    await i18n.changeLanguage("fr");
    expect(i18n.t("restaurant.home.locationsHeading")).toBe("Nos établissements");
  });
});
