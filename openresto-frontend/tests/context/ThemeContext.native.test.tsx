/**
 * @jest-environment jsdom
 *
 * Covers the off-web half of `getSystemScheme` and its `Appearance` subscription. The rest of
 * the suite (`ThemeContext.test.tsx`) pins the web half against `matchMedia`, and Platform.OS
 * is per-file, so the two platforms are two files.
 */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Appearance, Platform, Text, TouchableOpacity } from "react-native";
import { AppThemeProvider, useTheme } from "@/context/ThemeContext";

Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

type DeviceScheme = Parameters<
  Parameters<typeof Appearance.addChangeListener>[0]
>[0]["colorScheme"];
type SchemeListener = (preferences: { colorScheme: DeviceScheme }) => void;

let listeners: SchemeListener[] = [];
const remove = jest.fn();

const emit = (colorScheme: DeviceScheme) =>
  act(() => {
    listeners.forEach((listener) => listener({ colorScheme }));
  });

const TestComponent = () => {
  const { colorScheme, preference, setPreference } = useTheme();
  return (
    <>
      <Text testID="scheme">{colorScheme}</Text>
      <Text testID="pref">{preference}</Text>
      <TouchableOpacity testID="btn-light" onPress={() => setPreference("light")} />
      <TouchableOpacity testID="btn-system" onPress={() => setPreference("system")} />
    </>
  );
};

describe("ThemeContext on a device", () => {
  beforeEach(() => {
    listeners = [];
    remove.mockClear();
    jest.spyOn(Appearance, "getColorScheme").mockReturnValue("light");
    jest.spyOn(Appearance, "addChangeListener").mockImplementation((listener) => {
      listeners.push(listener as SchemeListener);
      return { remove } as ReturnType<typeof Appearance.addChangeListener>;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("follows the OS colour scheme instead of assuming dark", () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    expect(getByTestId("scheme").props.children).toBe("light");
  });

  it("keeps the dark default when the device declares no scheme", () => {
    (Appearance.getColorScheme as jest.Mock).mockReturnValue(null);

    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    expect(getByTestId("scheme").props.children).toBe("dark");
  });

  it("moves with the device when it switches to dark at sunset", () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    emit("dark");

    expect(getByTestId("scheme").props.children).toBe("dark");
  });

  it("treats a switch to an unspecified device scheme as dark", () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    emit("unspecified");

    expect(getByTestId("scheme").props.children).toBe("dark");
  });

  it("stops following the device once the diner picks a scheme, and resumes on 'system'", () => {
    const { getByTestId } = render(
      <AppThemeProvider>
        <TestComponent />
      </AppThemeProvider>
    );

    fireEvent.press(getByTestId("btn-light"));
    expect(remove).toHaveBeenCalledTimes(1);

    (Appearance.getColorScheme as jest.Mock).mockReturnValue("dark");
    emit("dark");
    expect(getByTestId("scheme").props.children).toBe("light");

    fireEvent.press(getByTestId("btn-system"));
    expect(getByTestId("scheme").props.children).toBe("dark");
  });
});
