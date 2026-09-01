/**
 * @jest-environment jsdom
 */
// jest.setup.ts stubs this module for every other suite; this one is about the module itself.
jest.unmock("@/hooks/use-color-scheme");

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/context/ThemeContext";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: jest.fn(),
}));

describe("useColorScheme", () => {
  it("returns the scheme ThemeContext resolved", () => {
    (useTheme as jest.Mock).mockReturnValue({ colorScheme: "dark" });
    expect(useColorScheme()).toBe("dark");
  });

  // The native build used to read React Native's device-only useColorScheme, which left an
  // explicit pick recorded but never rendered.
  it("follows an explicit light pick even when the context resolved it against a dark device", () => {
    (useTheme as jest.Mock).mockReturnValue({ colorScheme: "light", preference: "light" });
    expect(useColorScheme()).toBe("light");
  });
});
