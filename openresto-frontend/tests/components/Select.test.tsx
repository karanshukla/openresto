/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Modal, Platform } from "react-native";
import Select from "@/components/common/Select";
import { backdropStyleFor, panelStyleFor } from "@/components/common/Select.styles";
import { useBrand } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#000" })),
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

describe("Select", () => {
  const options = [
    { label: "Option 1", value: "1" },
    { label: "Option 2", value: "2" },
  ];
  const onSelect = jest.fn();

  beforeEach(() => {
    (useColorScheme as jest.Mock).mockReturnValue("light");
  });

  it("renders with selected option", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("opens options when pressed and selects new one", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    fireEvent.press(screen.getByText("Option 2"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("shows placeholder when no selectedValue", () => {
    render(<Select options={options} onSelect={onSelect} placeholder="Choose..." />);
    expect(screen.getByText("Choose...")).toBeTruthy();
  });

  it("shows default placeholder when no selectedValue and no placeholder prop", () => {
    render(<Select options={options} onSelect={onSelect} />);
    expect(screen.getByText("Select an option")).toBeTruthy();
  });

  it("defaults to light when useColorScheme returns nothing", () => {
    (useColorScheme as jest.Mock).mockReturnValue(undefined);
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("renders in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  it("shows checkmark on selected item inside modal", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    // Inside the modal, the selected item shows a checkmark
    expect(screen.getByText("✓", { includeHiddenElements: true })).toBeTruthy();
  });

  it("renders the item separator in dark mode when the modal is open", () => {
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
  });

  it("closes the modal when the backdrop is pressed", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    fireEvent.press(screen.getByTestId("select-backdrop"));
    expect(screen.queryByText("Option 2")).toBeNull();
  });

  it("closes the modal when onRequestClose fires (e.g. Android back button)", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Option 1"));
    expect(screen.getByText("Option 2")).toBeTruthy();
    act(() => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(screen.queryByText("Option 2")).toBeNull();
  });

  it("falls back to the default primary color when the brand has none", () => {
    (useBrand as jest.Mock).mockReturnValueOnce({ appName: "Test App", primaryColor: "" });
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    expect(screen.getByText("Option 1")).toBeTruthy();
  });

  /**
   * On web the options hang off the trigger like a dropdown; on native they stay a centred
   * sheet, which is the platform convention. The pair is the point — it is what stops the web
   * fix quietly changing how the pickers behave on a phone.
   */
  describe("placement", () => {
    const originalOS = Platform.OS;
    const setOS = (value: string) =>
      Object.defineProperty(Platform, "OS", { value, configurable: true });

    afterEach(() => setOS(originalOS));

    /**
     * `justifyContent` is the tell, not `flex: 1` — both backdrops carry that, so asserting on
     * it passes against either branch. This distinction is load-bearing: an earlier version of
     * this test asserted `flex: 1` and passed while rendering the centred sheet.
     */
    const isCentredSheet = () =>
      Object.prototype.hasOwnProperty.call(
        screen.getByTestId("select-backdrop").props.style,
        "justifyContent"
      );

    it("keeps the centred sheet on native, which is the platform convention there", () => {
      setOS("ios");

      render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
      fireEvent.press(screen.getByText("Option 1"));

      expect(isCentredSheet()).toBe(true);
      expect(screen.getByText("Option 2")).toBeTruthy();
    });

    /**
     * Web still falls back to the sheet whenever the trigger reports no box — which is every
     * time under react-test-renderer, where a ref is a component instance rather than a DOM
     * node. That is why the anchored branch is proven in the browser (`e2e/admin-activity.spec.ts`)
     * and its arithmetic in `tests/utils/selectAnchor.test.ts`, not here.
     */
    it("falls back to the centred sheet on web when the trigger cannot be measured", () => {
      setOS("web");

      render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
      fireEvent.press(screen.getByText("Option 1"));

      expect(isCentredSheet()).toBe(true);
      expect(screen.getByText("Option 2")).toBeTruthy();
    });

    /**
     * The anchored shape itself, exercised directly — the component cannot reach it under
     * react-test-renderer, and a style branch nothing can take is a style branch nobody checked.
     */
    it("hangs the panel off the measured trigger", () => {
      const anchored = panelStyleFor(
        { top: 146, left: 200, width: 240, maxHeight: 360 },
        "#ccc"
      ) as object[];

      expect(anchored).toContainEqual(
        expect.objectContaining({ top: 146, left: 200, width: 240, maxHeight: 360 })
      );
      expect(backdropStyleFor(true)).not.toHaveProperty("justifyContent");
    });

    /**
     * A flipped panel is pinned by its bottom edge. Setting both would leave the undefined one
     * fighting the edge that matters and stretch the panel across the gap.
     */
    it("pins a flipped panel by its bottom edge alone", () => {
      const flipped = panelStyleFor(
        { bottom: 181, left: 200, width: 240, maxHeight: 360 },
        "#ccc"
      ) as object[];

      const positioned = flipped.find((s) => "bottom" in s)!;
      expect(positioned).toEqual(expect.objectContaining({ bottom: 181 }));
      expect(positioned).not.toHaveProperty("top");
    });

    it("centres the sheet when there is no anchor", () => {
      const centred = panelStyleFor(null, "#ccc") as object[];

      expect(centred).toContainEqual(expect.objectContaining({ borderColor: "#ccc" }));
      expect(centred.some((s) => "top" in s)).toBe(false);
      expect(backdropStyleFor(false)).toHaveProperty("justifyContent", "center");
    });
  });

  it("highlights the trigger border when hovered", () => {
    render(<Select selectedValue="1" options={options} onSelect={onSelect} />);
    let node = screen.getByText("Option 1").parent;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: { hovered: boolean }) => unknown;
    expect(typeof styleFn).toBe("function");
    const hoveredStyle = styleFn({ hovered: true });
    expect(hoveredStyle).toContainEqual({ borderColor: "#000" });
  });
});
