import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
} from "@/constants/locales";

describe("constants/locales", () => {
  it("lists the four launch locales", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "fr", "es", "de"]);
  });

  it("defaults to en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it("labels every supported locale in its own language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[locale]).toBeTruthy();
    }
    expect(LOCALE_LABELS.fr).toBe("Français");
    expect(LOCALE_LABELS.es).toBe("Español");
    expect(LOCALE_LABELS.de).toBe("Deutsch");
  });

  describe("isSupportedLocale", () => {
    it("accepts every supported locale", () => {
      for (const locale of SUPPORTED_LOCALES) {
        expect(isSupportedLocale(locale)).toBe(true);
      }
    });

    it("rejects an unsupported value", () => {
      expect(isSupportedLocale("xx")).toBe(false);
    });

    it("rejects null and undefined", () => {
      expect(isSupportedLocale(null)).toBe(false);
      expect(isSupportedLocale(undefined)).toBe(false);
    });

    it("rejects an empty string", () => {
      expect(isSupportedLocale("")).toBe(false);
    });
  });
});
