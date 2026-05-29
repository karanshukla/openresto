import { useColorScheme } from "@/hooks/use-color-scheme";

describe("use-color-scheme", () => {
  it("re-exports useColorScheme from react-native", () => {
    expect(useColorScheme).toBeDefined();
    expect(typeof useColorScheme).toBe("function");
  });
});
