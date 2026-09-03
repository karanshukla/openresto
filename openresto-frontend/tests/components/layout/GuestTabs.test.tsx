import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";
import { IconFamily } from "@/components/common/Icon";
import GuestTabs from "@/components/layout/GuestTabs";

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", border: "#ccc", page: "#fff", card: "#fafafa", text: "#111" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
const originalOS = Platform.OS;
afterEach(() => setPlatform(originalOS));

const TABS = ["(home)", "(locations)", "(bookings)"] as const;

const tabs = () => screen.getByTestId("native-tabs");
const trigger = (name: string) => screen.getByTestId(`guest-tab-${name}`);
const iconOf = (name: string) => trigger(name).findByProps({ testID: "native-tab-icon" });
const labelOf = (name: string) =>
  trigger(name).findByProps({ testID: "native-tab-label" }).props.children;

/** The Ionicon a VectorIcon element in `src` names, in the family it names. */
const vectorIconName = (element: React.ReactElement) => {
  const props = element.props as { family: unknown; name: string };
  expect(props.family).toBe(IconFamily);
  return props.name;
};

/**
 * Issue #426. The bar is the platform's own now, so what this can pin is what each trigger
 * asks of it: which group it opens, what it is called, which glyphs it draws, and whether it
 * manages the content insets itself.
 */
describe("GuestTabs", () => {
  it("offers the two screens the web navbar owns, plus home, each opening its route group", () => {
    setPlatform("ios");
    render(<GuestTabs />);

    const triggers = screen.getAllByTestId(/^guest-tab-/).map((trigger) => trigger.props.name);
    expect(triggers).toEqual(TABS);
    expect(labelOf("(home)")).toBe("Home");
    expect(labelOf("(locations)")).toBe("Locations");
    expect(labelOf("(bookings)")).toBe("My Bookings");
  });

  it("tints the selected tab with the brand colour on both platforms", () => {
    setPlatform("ios");
    render(<GuestTabs />);
    expect(tabs().props.tintColor).toBe("#0a7ea4");

    screen.unmount();
    setPlatform("android");
    render(<GuestTabs />);
    expect(tabs().props.tintColor).toBe("#0a7ea4");
  });

  /**
   * A surface colour, blur or label style replaces the system tab bar appearance, and on
   * iOS 26 that appearance is the liquid glass this change exists for. Android's Material 3
   * bar is an opaque card surface with a pill behind the selected destination.
   */
  describe("bar surface", () => {
    it("leaves the iOS bar to the system", () => {
      setPlatform("ios");
      render(<GuestTabs />);

      expect(tabs().props).not.toHaveProperty("backgroundColor");
      expect(tabs().props).not.toHaveProperty("indicatorColor");
      expect(tabs().props).not.toHaveProperty("blurEffect");
    });

    it("draws the Material surface and the selected pill on Android", () => {
      setPlatform("android");
      render(<GuestTabs />);

      expect(tabs().props.backgroundColor).toBe("#fafafa");
      expect(tabs().props.indicatorColor).toBe("#0a7ea41f");
    });
  });

  /**
   * iOS would otherwise switch the first scroll view it finds to automatic insets, which
   * double-pads a root that already pads the status bar and pushes the home hero out from
   * under it; the roots pad the bar themselves through `useTabBarClearance`. Android lays the
   * content out above its opaque bar, which is exactly what every root wants left alone.
   */
  describe("content insets", () => {
    it.each(TABS)("are managed by the screens themselves on iOS for %s", (name) => {
      setPlatform("ios");
      render(<GuestTabs />);

      expect(trigger(name).props.disableAutomaticContentInsets).toBe(true);
    });

    it.each(TABS)("are left to the bar on Android for %s", (name) => {
      setPlatform("android");
      render(<GuestTabs />);

      expect(trigger(name).props.disableAutomaticContentInsets).toBe(false);
    });
  });

  /**
   * SF Symbols on iOS, Ionicons everywhere else: SF Symbols are not Apple's to license off
   * their platforms, and Ionicons on an iOS tab bar is one of the tells that the bar is not
   * the system's. Both sets are outlined at rest and filled when selected.
   */
  describe("glyphs", () => {
    it.each([
      ["(home)", "house", "house.fill", "home-outline", "home"],
      ["(locations)", "mappin.and.ellipse", "mappin.circle.fill", "location-outline", "location"],
      ["(bookings)", "ticket", "ticket.fill", "ticket-outline", "ticket"],
    ])(
      "%s draws %s / %s on iOS and %s / %s elsewhere",
      (name, sf, sfSelected, ion, ionSelected) => {
        setPlatform("ios");
        render(<GuestTabs />);

        const icon = iconOf(name).props;
        expect(icon.sf).toEqual({ default: sf, selected: sfSelected });
        expect(vectorIconName(icon.src.default)).toBe(ion);
        expect(vectorIconName(icon.src.selected)).toBe(ionSelected);
      }
    );
  });
});
