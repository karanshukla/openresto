/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import AlertModal from "@/components/common/AlertModal";
import { BrandProvider } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Modal } from "react-native";

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
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
  });

  const renderWithBrand = (ui: React.ReactElement) => render(<BrandProvider>{ui}</BrandProvider>);

  it("renders title and message when visible", () => {
    renderWithBrand(<AlertModal {...defaultProps} title="Alert" />);
    expect(screen.getByText("Alert")).toBeTruthy();
    expect(screen.getByText("Something happened")).toBeTruthy();
  });

  it("calls onClose when backdrop pressed", () => {
    renderWithBrand(<AlertModal {...defaultProps} />);
    // backdrop is the outer Pressable in AlertModal.tsx
    const backdrop = screen.getByText("Something happened").parent?.parent;
    fireEvent.press(backdrop as any);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renders in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    renderWithBrand(<AlertModal {...defaultProps} />);
    expect(screen.getByText("OK")).toBeTruthy();
  });
});
