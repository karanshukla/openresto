/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, act, fireEvent } from "@testing-library/react-native";
import { AppThemeProvider, useTheme } from "@/context/ThemeContext";
import { Platform, Text, TouchableOpacity } from "react-native";

// Mock Platform.OS specifically
Object.defineProperty(Platform, "OS", {
  get: jest.fn(() => "web"),
  configurable: true,
});

const TestComponent = () => {
  const { colorScheme, preference, setPreference, toggle } = useTheme();
  return (
    <>
      <Text testID="scheme">{colorScheme}</Text>
      <Text testID="pref">{preference}</Text>
      <TouchableOpacity testID="btn-light" onPress={() => setPreference("light")} />
      <TouchableOpacity testID="btn-system" onPress={() => setPreference("system")} />
      <TouchableOpacity testID="btn-toggle" onPress={() => toggle()} />
    </>
  );
};

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    document.documentElement.className = "";
    document.body.className = "";
    (window.matchMedia as jest.Mock) = jest.fn().mockReturnValue({ matches: true });
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  it("provides default 'system' preference and matches system scheme", () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    expect(getByTestId("pref").props.children).toBe("system");
    expect(getByTestId("scheme").props.children).toBe("dark"); // matchMedia: true
  });

  it("updates preference and persists to localStorage", () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    fireEvent.press(getByTestId("btn-light"));

    expect(getByTestId("pref").props.children).toBe("light");
    expect(localStorage.getItem("openresto-theme")).toBe("light");
  });

  it("toggles theme correctly", () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    // Initial is dark (system)
    fireEvent.press(getByTestId("btn-toggle"));

    expect(getByTestId("scheme").props.children).toBe("light");
  });

  it("applies theme to document element on web", () => {
    render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    expect(document.documentElement.className).toBe("dark");
  });

  it("setPreference('system') removes theme from localStorage", () => {
    localStorage.setItem("openresto-theme", "light");
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );
    fireEvent.press(getByTestId("btn-system"));
    expect(localStorage.getItem("openresto-theme")).toBeNull();
  });

  it("toggles from light to dark", () => {
    localStorage.setItem("openresto-theme", "light");
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );
    expect(getByTestId("scheme").props.children).toBe("light");
    fireEvent.press(getByTestId("btn-toggle"));
    expect(getByTestId("scheme").props.children).toBe("dark");
  });

  it("reads system scheme as light when prefers-dark media query is false", () => {
    (window.matchMedia as jest.Mock) = jest.fn().mockReturnValue({ matches: false });
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );
    expect(getByTestId("scheme").props.children).toBe("light");
  });

  it("stub functions in default context are no-ops when used outside provider", () => {
    function Outside() {
      const { setPreference, toggle } = useTheme();
      setPreference("light");
      toggle();
      return null;
    }
    render(<Outside />);
    // Verifies default context stub functions don't throw
  });

  it("early-returns for non-web platform (covers Platform.OS guards)", () => {
    Object.defineProperty(Platform, "OS", {
      get: jest.fn(() => "ios"),
      configurable: true,
    });
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );
    expect(getByTestId("pref").props.children).toBe("system");
    fireEvent.press(getByTestId("btn-light"));
    expect(localStorage.getItem("openresto-theme")).toBeNull();
    Object.defineProperty(Platform, "OS", {
      get: jest.fn(() => "web"),
      configurable: true,
    });
  });
});
