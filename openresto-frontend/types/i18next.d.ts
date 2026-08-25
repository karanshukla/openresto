import "i18next";
import type en from "@/locales/en.json";

/**
 * Module augmentation on i18next's `resources` shape. `en.json` is the authority for every
 * key that exists — `tests/i18n/parity.test.ts` keeps the other three locale files in lock
 * step with it. With this in place, a typo'd key at a `t()` call site is a `tsc` failure
 * rather than a silent runtime fallback to the raw key string.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
  }
}
