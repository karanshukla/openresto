import { render, screen } from "@testing-library/react-native";
import { TabBarIcon } from "@/components/layout/TabBarIcon";

// jest.setup renders @expo/vector-icons as null, which is fine for presence checks but leaves
// nothing to query; this suite needs to tell the two icon sets apart.
/**
 * The haste platform decides which `expo-symbols` implementation loads, while `Platform.OS`
 * decides which branch this component takes. Under the Android jest project those two disagree
 * — OS says ios, resolution gives the Android SymbolView, which renders the fallback — a state
 * no device is ever in. Mocking the module makes these tests about the choice this component
 * makes, which is all it is responsible for.
 */
jest.mock("expo-symbols", () => {
  const { View } = require("react-native");
  return { SymbolView: (props: Record<string, unknown>) => <View {...props} /> };
});

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return {
    // testID last: Icon forwards its own (undefined here), which would otherwise win.
    Ionicons: (props: Record<string, unknown>) => <View {...props} testID="tab-bar-ionicon" />,
  };
});

// Reached through require rather than a static import: under the Android jest project the
// imported binding and the one the component reads are not the same object, so defining the
// property on the import silently changed nothing and every iOS case took the Android branch.
const platform = () => require("react-native").Platform;
const setPlatform = (os: string) =>
  Object.defineProperty(platform(), "OS", { value: os, configurable: true });

const originalOS = platform().OS;
afterEach(() => setPlatform(originalOS));

/**
 * #426. Ionicons on an iOS tab bar is one of the tells that the bar is not the system's own.
 * SF Symbols cannot ship off Apple's platforms, so the two sets have to coexist.
 */
describe("TabBarIcon", () => {
  const renderIcon = (selected = false) =>
    render(
      <TabBarIcon name="ticket-outline" symbol="ticket" color="#0a7ea4" selected={selected} />
    );

  it("draws the SF Symbol on iOS", () => {
    setPlatform("ios");
    renderIcon();

    expect(screen.getByTestId("tab-bar-symbol", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("tab-bar-ionicon", { includeHiddenElements: true })).toBeNull();
  });

  it("draws the Ionicon on Android", () => {
    setPlatform("android");
    renderIcon();

    expect(screen.getByTestId("tab-bar-ionicon", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("tab-bar-symbol", { includeHiddenElements: true })).toBeNull();
  });

  // A device whose OS predates the symbol would otherwise draw a blank where the glyph goes.
  it("keeps an Ionicon in reserve behind the symbol", () => {
    setPlatform("ios");
    renderIcon();

    expect(
      screen.getByTestId("tab-bar-symbol", { includeHiddenElements: true }).props.fallback
    ).toBeTruthy();
  });

  it("weights the symbol to match the selection", () => {
    setPlatform("ios");
    const { rerender } = renderIcon(true);
    expect(screen.getByTestId("tab-bar-symbol", { includeHiddenElements: true }).props.weight).toBe(
      "semibold"
    );

    rerender(<TabBarIcon name="ticket-outline" symbol="ticket" color="#0a7ea4" selected={false} />);
    expect(screen.getByTestId("tab-bar-symbol", { includeHiddenElements: true }).props.weight).toBe(
      "regular"
    );
  });

  // The glyph duplicates the label under it, so the tab's own label is what gets announced.
  it("stays out of the accessibility tree", () => {
    setPlatform("ios");
    renderIcon();

    expect(
      screen.getByTestId("tab-bar-symbol", { includeHiddenElements: true }).props
        .accessibilityElementsHidden
    ).toBe(true);
  });
});
