import en from "@/locales/en.json";
import fr from "@/locales/fr.json";
import es from "@/locales/es.json";
import de from "@/locales/de.json";
import { SUPPORTED_LOCALES } from "@/constants/locales";

type Json = { [key: string]: Json | string };

/**
 * Flattens a nested locale object into its leaf key paths ("restaurant.home.heroSubtitle"),
 * so two locale files can be compared by the *shape* of their keys regardless of the
 * (untranslated) string each leaf holds.
 */
function leafKeyPaths(node: Json, prefix = ""): string[] {
  return Object.keys(node)
    .sort()
    .flatMap((key) => {
      const value = node[key];
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === "string" ? [path] : leafKeyPaths(value, path);
    });
}

const LOCALE_FILES: Record<string, Json> = { en, fr, es, de };

describe("i18n locale key parity", () => {
  it("ships a locale file for every entry in SUPPORTED_LOCALES", () => {
    expect(Object.keys(LOCALE_FILES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });

  const englishKeys = leafKeyPaths(en);

  it("en.json has at least one key (sanity check the fixture isn't empty)", () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_LOCALES.filter((locale) => locale !== "en"))(
    "%s.json has the exact same leaf key paths as en.json",
    (locale) => {
      expect(leafKeyPaths(LOCALE_FILES[locale])).toEqual(englishKeys);
    }
  );

  it("only nests keys under the six approved top-level segments", () => {
    const approved = ["common", "booking", "restaurant", "lookup", "admin", "errors"];
    for (const locale of SUPPORTED_LOCALES) {
      for (const topLevelKey of Object.keys(LOCALE_FILES[locale])) {
        expect(approved).toContain(topLevelKey);
      }
    }
  });
});
