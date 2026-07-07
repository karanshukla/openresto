import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import ErrorScreen from "@/components/common/ErrorScreen";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

describe("ErrorScreen", () => {
  it("renders default title and message when none provided", () => {
    render(<ErrorScreen />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("An unexpected error occurred. Try again.")).toBeTruthy();
  });

  it("renders custom title and message when provided", () => {
    render(<ErrorScreen title="Custom Title" message="Custom body text." />);
    expect(screen.getByText("Custom Title")).toBeTruthy();
    expect(screen.getByText("Custom body text.")).toBeTruthy();
  });

  it("shows 'Try again' and calls retry when pressed", () => {
    const retry = jest.fn();
    render(<ErrorScreen retry={retry} />);
    const btn = screen.getByLabelText("Try again");
    fireEvent.press(btn);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("hides 'Try again' when retry is not provided", () => {
    render(<ErrorScreen />);
    expect(screen.queryByLabelText("Try again")).toBeNull();
  });

  it("shows 'Go to home' and calls onGoHome when pressed", () => {
    const onGoHome = jest.fn();
    render(<ErrorScreen onGoHome={onGoHome} />);
    const btn = screen.getByLabelText("Go to home");
    fireEvent.press(btn);
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it("hides 'Go to home' when onGoHome is not provided", () => {
    render(<ErrorScreen />);
    expect(screen.queryByLabelText("Go to home")).toBeNull();
  });

  it("hides the actions row entirely when neither retry nor onGoHome is provided", () => {
    render(<ErrorScreen />);
    expect(screen.queryByLabelText("Try again")).toBeNull();
    expect(screen.queryByLabelText("Go to home")).toBeNull();
  });
});
