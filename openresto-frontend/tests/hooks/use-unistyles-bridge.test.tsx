/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { UnistylesRuntime } from "react-native-unistyles";
import { useUnistylesBridge } from "@/hooks/use-unistyles-bridge";
import { theme } from "@/theme/theme";

const mockTheme = { colorScheme: "light" as "light" | "dark" };
const mockBrand = { primaryColor: "#123456" as string };

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => mockTheme,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrand,
}));

function Probe() {
  useUnistylesBridge();
  return null;
}

describe("useUnistylesBridge", () => {
  let setTheme: jest.SpyInstance;
  let updateTheme: jest.SpyInstance;

  beforeEach(() => {
    mockTheme.colorScheme = "light";
    mockBrand.primaryColor = "#123456";
    setTheme = jest.spyOn(UnistylesRuntime, "setTheme").mockImplementation(() => {});
    updateTheme = jest.spyOn(UnistylesRuntime, "updateTheme").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("forwards the active color scheme to the Unistyles runtime", () => {
    render(<Probe />);
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("forwards a dark scheme too", () => {
    mockTheme.colorScheme = "dark";
    render(<Probe />);
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("patches the brand accent into both themes", () => {
    render(<Probe />);

    expect(updateTheme).toHaveBeenCalledTimes(2);
    expect(updateTheme.mock.calls.map((call) => call[0])).toEqual(["light", "dark"]);

    const updater = updateTheme.mock.calls[0][1] as (t: { colors: Record<string, string> }) => {
      colors: Record<string, string>;
    };
    expect(updater({ colors: { primary: "#000000", text: "#111111" } })).toEqual({
      colors: { primary: "#123456", text: "#111111" },
    });
  });

  it("falls back to the static primary token when the brand has no colour", () => {
    mockBrand.primaryColor = "";
    render(<Probe />);

    const updater = updateTheme.mock.calls[0][1] as (t: { colors: Record<string, string> }) => {
      colors: Record<string, string>;
    };
    expect(updater({ colors: { primary: "#000000" } }).colors.primary).toBe(theme.colors.primary);
  });

  describe("stylesheet ordering on web", () => {
    const asWeb = (fn: () => void) => {
      const original = Platform.OS;
      Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
      try {
        fn();
      } finally {
        Object.defineProperty(Platform, "OS", { value: original, configurable: true });
      }
    };

    const styleIds = () => Array.from(document.head.querySelectorAll("style")).map((tag) => tag.id);

    afterEach(() => {
      document.head.querySelectorAll("style").forEach((tag) => tag.remove());
    });

    it("moves the Unistyles tag after react-native-web's reset", () => {
      for (const id of ["unistyles-web", "react-native-stylesheet"]) {
        const tag = document.createElement("style");
        tag.id = id;
        document.head.appendChild(tag);
      }

      asWeb(() => render(<Probe />));

      expect(styleIds()).toEqual(["react-native-stylesheet", "unistyles-web"]);
    });

    it("is a no-op when there is no Unistyles tag to move", () => {
      const tag = document.createElement("style");
      tag.id = "react-native-stylesheet";
      document.head.appendChild(tag);

      asWeb(() => render(<Probe />));

      expect(styleIds()).toEqual(["react-native-stylesheet"]);
    });
  });
});
