/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import AlertModal from "@/components/common/AlertModal";
import { BrandProvider } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

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

// Mock Modal to render children
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible, onRequestClose }: any) => {
    if (!visible) return null;
    return (
      <rn.View
        testID="modal-container"
        accessibilityHint="modal"
        accessibilityLabel="modal"
        onAccessibilityEscape={onRequestClose}
      >
        {children}
      </rn.View>
    );
  };
  return rn;
});

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
    // backdrop is the outer Pressable.
    // In our Modal mock, it's just in the tree.
    // We can find by text "Something happened" then go to parent?
    // Or just look for the first pressable.
    const backdrop = screen.getByText("Something happened").parent?.parent;
    fireEvent.press(backdrop as any);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose on request close (android back)", () => {
    renderWithBrand(<AlertModal {...defaultProps} />);
    const modal = screen.getByTestId("modal-container");
    modal.props.onAccessibilityEscape(); // Trigger the mock callback
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("renders in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    renderWithBrand(<AlertModal {...defaultProps} />);
    expect(screen.getByText("OK")).toBeTruthy();
  });
});
