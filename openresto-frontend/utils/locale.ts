let activeLocale: string | undefined;

/** The locale display formatters should use. `undefined` means "follow the device". */
export function getActiveLocale(): string | undefined {
  return activeLocale;
}

export function setActiveLocale(locale: string | undefined): void {
  activeLocale = locale;
}
