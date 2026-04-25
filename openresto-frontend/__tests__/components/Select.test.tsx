/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import Select from "@/components/common/Select";
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

const options = [
  { label: "Option A", value: "a" },
  { label: "Option B", value: "b" },
];

describe("Select", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useColorScheme as jest.Mock).mockReturnValue("light");
  });

  const renderWithBrand = (ui: React.ReactElement) => render(<BrandProvider>{ui}</BrandProvider>);

  it("renders placeholder and opens modal", () => {
    renderWithBrand(<Select options={options} onSelect={jest.fn()} placeholder="Pick" />);
    expect(screen.getByText("Pick")).toBeTruthy();

    fireEvent.press(screen.getByText("Pick"));
    expect(screen.getByText("Option A")).toBeTruthy();
  });

  it("calls onClose when backdrop pressed", () => {
    renderWithBrand(<Select options={options} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByText("Select an option")); // Open

    // In our component, backdrop is a Pressable wrapping modal content.
    const backdrop = screen.getByText("Option A").parent?.parent?.parent;
    fireEvent.press(backdrop as any);
    expect(screen.queryByText("Option A")).toBeNull();
  });

  it("calls onSelect and closes modal", () => {
    const onSelect = jest.fn();
    renderWithBrand(<Select options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Select an option"));
    fireEvent.press(screen.getByText("Option A"));

    expect(onSelect).toHaveBeenCalledWith("a");
    expect(screen.queryByText("Option A")).toBeNull();
  });

  it("renders correctly in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    renderWithBrand(<Select options={options} onSelect={jest.fn()} selectedValue="b" />);
    expect(screen.getByText("Option B")).toBeTruthy();
  });
});
