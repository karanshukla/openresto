import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LocaleRadioList } from "@/components/common/LocaleRadioList";
import { useLocale } from "@/context/LocaleContext";

jest.mock("@/context/LocaleContext", () => ({ useLocale: jest.fn() }));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", input: "#f5f5f5" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

const mockSetLocale = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useLocale as jest.Mock).mockReturnValue({ locale: "en", setLocale: mockSetLocale });
});

describe("LocaleRadioList", () => {
  it("lists every shipped language, each labelled in its own language", () => {
    render(<LocaleRadioList />);

    expect(screen.getByTestId("language-radiogroup")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("Français")).toBeTruthy();
    expect(screen.getByText("Español")).toBeTruthy();
    expect(screen.getByText("Deutsch")).toBeTruthy();
  });

  it("marks the active locale checked via radio semantics", () => {
    (useLocale as jest.Mock).mockReturnValue({ locale: "de", setLocale: mockSetLocale });

    render(<LocaleRadioList />);

    expect(screen.getByLabelText("Deutsch").props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByLabelText("English").props.accessibilityState).toEqual({ checked: false });
  });

  it("writes a pick through LocaleContext and reports it to its host", () => {
    const onSelect = jest.fn();
    render(<LocaleRadioList onSelect={onSelect} />);

    fireEvent.press(screen.getByLabelText("Français"));

    expect(mockSetLocale).toHaveBeenCalledWith("fr");
    expect(onSelect).toHaveBeenCalledWith("fr");
  });

  it("highlights the row under the pointer", () => {
    render(<LocaleRadioList />);

    let node: ReturnType<typeof screen.getByLabelText> | null = screen.getByLabelText("English");
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: {
      hovered: boolean;
      pressed: boolean;
    }) => unknown[];

    expect(styleFn({ hovered: true, pressed: false })).toContainEqual({
      backgroundColor: "#f5f5f5",
    });
    expect(styleFn({ hovered: false, pressed: false })).not.toContainEqual({
      backgroundColor: "#f5f5f5",
    });
  });

  it("writes a pick with no host to report to", () => {
    render(<LocaleRadioList testID="custom-group" />);

    fireEvent.press(screen.getByLabelText("Español"));

    expect(mockSetLocale).toHaveBeenCalledWith("es");
    expect(screen.getByTestId("custom-group")).toBeTruthy();
  });
});
