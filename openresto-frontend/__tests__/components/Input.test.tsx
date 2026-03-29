import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import Input from "@/components/common/Input";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeTruthy();
  });

  it("displays the current value", () => {
    render(<Input value="Hello" />);
    expect(screen.getByDisplayValue("Hello")).toBeTruthy();
  });

  it("fires onChangeText when text changes", () => {
    const onChangeText = jest.fn();
    render(<Input placeholder="Type here" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText("Type here"), "new value");
    expect(onChangeText).toHaveBeenCalledWith("new value");
  });

  it("renders as editable by default", () => {
    render(<Input placeholder="Edit me" />);
    const input = screen.getByPlaceholderText("Edit me");
    expect(input.props.editable).not.toBe(false);
  });
});
