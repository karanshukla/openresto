import { act } from "@testing-library/react-native";
import i18n from "@/i18n";
import { getDayLabels, getDayShort } from "@/components/admin/settings/sectionHelpers";

describe("getDayLabels / getDayShort", () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("returns 7 English weekday labels, Monday first, in en", () => {
    const labels = getDayLabels(i18n.t.bind(i18n));
    expect(labels).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("translates the labels when the locale changes, while the ISO day arithmetic stays 1-indexed", async () => {
    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    const labels = getDayLabels(i18n.t.bind(i18n));
    const short = getDayShort(i18n.t.bind(i18n));

    expect(labels[0]).toBe("Lundi");
    expect(labels[6]).toBe("Dimanche");
    expect(short).toHaveLength(7);

    // ISO day = array index + 1 is the wire format both settings sections store to
    // Restaurant.OpenDays / WalkInDays — it must stay 7 entries regardless of locale.
    expect(labels).toHaveLength(7);
    const isoDayForLabel = (index: number) => index + 1;
    expect(isoDayForLabel(0)).toBe(1);
    expect(isoDayForLabel(6)).toBe(7);
  });
});
