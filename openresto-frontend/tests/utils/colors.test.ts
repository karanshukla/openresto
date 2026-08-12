import { hexToRgb, hexToRgba } from "@/utils/colors";

describe("colors utility - hexToRgb", () => {
  it("parses a hex color written without the leading hash", () => {
    expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses a short hex color written without the leading hash", () => {
    expect(hexToRgb("f00")).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("colors utility - hexToRgba", () => {
  it("converts #ffffff to rgba(255,255,255,1)", () => {
    expect(hexToRgba("#ffffff", 1)).toBe("rgba(255,255,255,1)");
  });

  it("converts #000000 to rgba(0,0,0,0.5)", () => {
    expect(hexToRgba("#000000", 0.5)).toBe("rgba(0,0,0,0.5)");
  });

  it("converts #ff0000 to rgba(255,0,0,0)", () => {
    expect(hexToRgba("#ff0000", 0)).toBe("rgba(255,0,0,0)");
  });

  it("returns rgba(0,0,0,alpha) for null input", () => {
    expect(hexToRgba(null as unknown as string, 0.5)).toBe("rgba(0,0,0,0.5)");
  });

  it("returns rgba(0,0,0,alpha) for undefined input", () => {
    expect(hexToRgba(undefined as unknown as string, 1)).toBe("rgba(0,0,0,1)");
  });

  it("returns rgba(0,0,0,alpha) for non-string number input", () => {
    expect(hexToRgba(123 as unknown as string, 1)).toBe("rgba(0,0,0,1)");
  });

  it("returns rgba(0,0,0,alpha) for hex with invalid length", () => {
    expect(hexToRgba("#fffff", 1)).toBe("rgba(0,0,0,1)");
  });

  it("converts short #rgb format (#f00 → red)", () => {
    expect(hexToRgba("#f00", 1)).toBe("rgba(255,0,0,1)");
  });
});
