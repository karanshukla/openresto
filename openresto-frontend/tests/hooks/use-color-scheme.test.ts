/**
 * @jest-environment jsdom
 */

describe("use-color-scheme (native re-export)", () => {
  it("re-exports useColorScheme from react-native", () => {
    const mod = require("@/hooks/use-color-scheme");
    expect(typeof mod.useColorScheme).toBe("function");
  });
});
