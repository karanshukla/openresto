import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import ConfirmModal from "@/components/common/ConfirmModal";

// Mock the useColorScheme hook
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("ConfirmModal", () => {
  const defaultProps = {
    visible: true,
    message: "Are you sure?",
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and message when visible", () => {
    render(<ConfirmModal {...defaultProps} title="Delete Item" />);
    expect(screen.getByText("Delete Item")).toBeTruthy();
    expect(screen.getByText("Are you sure?")).toBeTruthy();
  });

  it("uses default title 'Confirm' when not provided", () => {
    render(<ConfirmModal {...defaultProps} />);
    // Title and confirm button both say "Confirm" — expect at least 2
    expect(screen.getAllByText("Confirm")).toHaveLength(2);
  });

  it("uses custom button labels", () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="Yes, delete" cancelLabel="No, keep" />);
    expect(screen.getByText("Yes, delete")).toBeTruthy();
    expect(screen.getByText("No, keep")).toBeTruthy();
  });

  it("uses default button labels", () => {
    render(<ConfirmModal {...defaultProps} title="Action" />);
    expect(screen.getByText("Confirm")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("calls onConfirm when confirm button pressed", () => {
    render(<ConfirmModal {...defaultProps} confirmLabel="OK" />);
    fireEvent.press(screen.getByText("OK"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button pressed", () => {
    render(<ConfirmModal {...defaultProps} cancelLabel="Nope" />);
    fireEvent.press(screen.getByText("Nope"));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });
});
