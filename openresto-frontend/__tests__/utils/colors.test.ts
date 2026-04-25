import { hexToRgba } from "@/utils/colors";

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
});
