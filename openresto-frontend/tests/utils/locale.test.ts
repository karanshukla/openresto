import { getActiveLocale, setActiveLocale } from "@/utils/locale";

afterEach(() => {
  setActiveLocale(undefined);
});

describe("locale", () => {
  it("defaults to undefined (follow the device)", () => {
    expect(getActiveLocale()).toBeUndefined();
  });

  it("returns whatever was last set", () => {
    setActiveLocale("fr");
    expect(getActiveLocale()).toBe("fr");
    setActiveLocale("es");
    expect(getActiveLocale()).toBe("es");
  });
});
