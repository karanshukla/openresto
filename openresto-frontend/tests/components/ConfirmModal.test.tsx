import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useBrand } from "@/context/BrandContext";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Open Resto", primaryColor: "#0a7ea4" })),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
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
    (useBrand as jest.Mock).mockReturnValue({ appName: "Open Resto", primaryColor: "#0a7ea4" });
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

  it("renders a destructive confirm button", () => {
    render(<ConfirmModal {...defaultProps} destructive confirmLabel="Delete" />);
    fireEvent.press(screen.getByText("Delete"));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("falls back to the default primary color when the brand has none", () => {
    (useBrand as jest.Mock).mockReturnValue({ appName: "Open Resto", primaryColor: "" });
    render(<ConfirmModal {...defaultProps} confirmLabel="OK" />);
    expect(screen.getByText("OK")).toBeTruthy();
  });
});
