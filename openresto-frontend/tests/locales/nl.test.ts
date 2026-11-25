import en from "@/locales/en.json";
import nl from "@/locales/nl.json";

function flatten(value: unknown, prefix = "", result: Record<string, string> = {}) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected an object at ${prefix || "root"}`);
  }
  for (const [key, item] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === "string") result[path] = item;
    else flatten(item, path, result);
  }
  return result;
}

function variables(text: string) {
  return [...text.matchAll(/\{\{[^}]+\}\}/g)].map(([match]) => match).sort();
}

describe("Dutch translation integrity", () => {
  const english = flatten(en);
  const dutch = flatten(nl);

  it("provides every key in the original language without extras", () => {
    expect(Object.keys(dutch).sort()).toEqual(Object.keys(english).sort());
  });

  it("preserves interpolated variables in every translation", () => {
    for (const [key, source] of Object.entries(english)) {
      expect(variables(dutch[key])).toEqual(variables(source));
    }
  });

  it("includes Dutch guest-facing booking labels", () => {
    expect(nl.booking.form.confirmBookingLabel).toBe("Bevestig reservering");
    expect(nl.booking.result.statusConfirmed).toBe("Reservering bevestigd");
    expect(nl.lookup.title).toBe("Mijn reservering zoeken");
  });
});
