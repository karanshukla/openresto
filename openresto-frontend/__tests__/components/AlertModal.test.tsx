import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import AlertModal from "@/components/common/AlertModal";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("AlertModal", () => {
  const defaultProps = {
    visible: true,
    message: "Something happened",
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and message when visible", () => {
    render(<AlertModal {...defaultProps} title="Alert" />);
    expect(screen.getByText("Alert")).toBeTruthy();
    expect(screen.getByText("Something happened")).toBeTruthy();
  });

  it("uses default title 'Notice' when not provided", () => {
    render(<AlertModal {...defaultProps} />);
    expect(screen.getByText("Notice")).toBeTruthy();
  });

  it("uses custom button label", () => {
    render(<AlertModal {...defaultProps} buttonLabel="Got it" />);
    expect(screen.getByText("Got it")).toBeTruthy();
  });

  it("uses default button label 'OK'", () => {
    render(<AlertModal {...defaultProps} />);
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("calls onClose when button pressed", () => {
    render(<AlertModal {...defaultProps} buttonLabel="Dismiss" />);
    fireEvent.press(screen.getByText("Dismiss"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
