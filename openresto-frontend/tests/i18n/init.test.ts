import i18n from "@/i18n";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/constants/locales";

describe("i18n/index", () => {
  afterEach(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  it("bundles only DEFAULT_LOCALE up front", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(i18n.hasResourceBundle(locale, "translation")).toBe(locale === DEFAULT_LOCALE);
    }
  });

  it("loads another locale's translations when it is first asked for", async () => {
    await i18n.loadLanguages("de");
    expect(i18n.hasResourceBundle("de", "translation")).toBe(true);
  });

  it("keeps a locale unloaded when its chunk fails to load", async () => {
    const { localeLoaders } = jest.requireMock("@/i18n/loaders");
    jest.spyOn(localeLoaders, "es").mockRejectedValueOnce(new Error("offline"));
    await i18n.loadLanguages("es");
    expect(i18n.hasResourceBundle("es", "translation")).toBe(false);
  });

  it("has no translations to load for a language this app does not ship", async () => {
    await i18n.loadLanguages("xx");
    expect(i18n.hasResourceBundle("xx", "translation")).toBe(false);
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
