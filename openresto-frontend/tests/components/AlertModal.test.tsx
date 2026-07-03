/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import AlertModal from "@/components/common/AlertModal";
import { useBrand } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Open Resto", primaryColor: "#0a7ea4" })),
}));

describe("AlertModal", () => {
  const defaultProps = {
    visible: true,
    message: "Something happened",
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useColorScheme as jest.Mock).mockReturnValue("light");
    (useBrand as jest.Mock).mockReturnValue({ appName: "Open Resto", primaryColor: "#0a7ea4" });
  });

  it("renders title and message when visible", () => {
    render(<AlertModal {...defaultProps} title="Alert" />);
    expect(screen.getByText("Alert")).toBeTruthy();
    expect(screen.getByText("Something happened")).toBeTruthy();
  });

  it("calls onClose when backdrop pressed", () => {
    render(<AlertModal {...defaultProps} />);
    // backdrop is the outer Pressable in AlertModal.tsx
    const backdrop = screen.getByText("Something happened").parent?.parent;
    fireEvent.press(backdrop as any);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renders in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    render(<AlertModal {...defaultProps} />);
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("falls back to the default button color when the brand has no primary color", () => {
    (useBrand as jest.Mock).mockReturnValue({ appName: "Open Resto", primaryColor: "" });
    render(<AlertModal {...defaultProps} />);
    expect(screen.getByText("OK")).toBeTruthy();
  });
});
