import { useColorScheme } from "@/hooks/use-color-scheme.web";
import { useTheme } from "@/context/ThemeContext";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: jest.fn(),
}));

describe("useColorScheme hook (web)", () => {
  it("returns colorScheme from ThemeContext", () => {
    (useTheme as jest.Mock).mockReturnValue({ colorScheme: "dark" });
    expect(useColorScheme()).toBe("dark");
  });
});
