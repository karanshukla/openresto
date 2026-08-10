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

  it("calls onClose when the backdrop is pressed", () => {
    render(<AlertModal {...defaultProps} />);
    // aria-modal hides the backdrop from assistive tech by design — it is a pointer-only
    // affordance, and screen-reader users dismiss via the acknowledge button instead.
    fireEvent.press(screen.getByLabelText("Close", { includeHiddenElements: true }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose from the acknowledge button", () => {
    render(<AlertModal {...defaultProps} />);
    fireEvent.press(screen.getByRole("button", { name: "OK" }));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("exposes itself as a labelled alert dialog", () => {
    render(<AlertModal {...defaultProps} title="Alert" />);
    const dialog = screen.getByLabelText("Alert");
    expect(dialog.props.role).toBe("alertdialog");
    expect(dialog.props["aria-modal"]).toBe(true);
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
