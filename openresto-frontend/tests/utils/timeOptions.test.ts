import { generateTimeOptions } from "@/utils/timeOptions";

describe("generateTimeOptions", () => {
  it("defaults to a 09:00-22:00 range when called with no arguments", () => {
    const options = generateTimeOptions();
    expect(options[0]).toEqual({ label: "09:00", value: "09:00" });
    expect(options[options.length - 1]).toEqual({ label: "22:00", value: "22:00" });
  });

  it("generates 15-minute increments within a custom range", () => {
    const options = generateTimeOptions("08:00", "09:00");
    expect(options.map((o) => o.value)).toEqual(["08:00", "08:15", "08:30", "08:45", "09:00"]);
  });

  it("includes a partial final step when the range isn't a multiple of 15 minutes", () => {
    const options = generateTimeOptions("08:00", "08:20");
    expect(options.map((o) => o.value)).toEqual(["08:00", "08:15"]);
  });
});
