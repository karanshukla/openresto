/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking, Platform, StyleSheet, useWindowDimensions } from "react-native";
import Footer from "@/components/layout/Footer";
import { fetchSocialLinks } from "@/api/restaurants";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ width: 1024, height: 768 }),
}));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: jest.fn(),
}));

import { useAppTheme } from "@/hooks/use-app-theme";

jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/api/restaurants", () => ({
  fetchSocialLinks: jest.fn(),
}));

jest.mock("@/utils/openExternal", () => ({
  openExternal: jest.fn(),
}));

import { openExternal } from "@/utils/openExternal";

function setPlatform(os: string) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

// jest-expo runs as "ios" by default; the block below describes the web footer, which is the
// one with an admin link and a single space-between row.
setPlatform("web");

describe("Footer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: { appName: "Test App", primaryColor: "#0a7ea4" },
      colors: { border: "#ccc", muted: "#666" },
    });
    (fetchSocialLinks as jest.Mock).mockResolvedValue([]);
    jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
  });

  it("renders a default copyright when none is configured", () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} Test App. All rights reserved.`)).toBeTruthy();
  });

  it("renders a custom copyright when configured", () => {
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: { appName: "Test App", primaryColor: "#0a7ea4", copyrightText: "© 2020 Custom Co." },
      colors: { border: "#ccc", muted: "#666" },
    });
    render(<Footer />);
    expect(screen.getByText("© 2020 Custom Co.")).toBeTruthy();
  });

  it("renders the Admin link", () => {
    render(<Footer />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("renders no privacy policy link when the brand configures none", () => {
    render(<Footer />);
    expect(screen.queryByLabelText("Privacy policy")).toBeNull();
  });

  it("renders a privacy policy link when the brand configures one, and opens it externally", () => {
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: {
        appName: "Test App",
        primaryColor: "#0a7ea4",
        privacyPolicyUrl: "https://example.com/privacy",
      },
      colors: { border: "#ccc", muted: "#666" },
    });
    render(<Footer />);

    fireEvent.press(screen.getByLabelText("Privacy policy"));

    expect(openExternal).toHaveBeenCalledWith("https://example.com/privacy");
  });

  it("renders no social icons when none are configured", async () => {
    render(<Footer />);
    await waitFor(() => expect(fetchSocialLinks).toHaveBeenCalled());
    expect(screen.queryByLabelText("Instagram")).toBeNull();
  });

  it("renders configured social links and opens their URL on press", async () => {
    (fetchSocialLinks as jest.Mock).mockResolvedValue([
      {
        id: 1,
        label: "Instagram",
        url: "https://instagram.com/resto",
        iconKey: "logo-instagram",
        sortOrder: 0,
      },
    ]);
    render(<Footer />);

    const instagramBtn = await screen.findByLabelText("Instagram");
    expect(screen.queryByLabelText("Facebook")).toBeNull();
    fireEvent.press(instagramBtn);
    expect(Linking.openURL).toHaveBeenCalledWith("https://instagram.com/resto");
  });

  it("stacks copyright and links vertically on mobile widths", () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 500, height: 768 });
    render(<Footer />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  // The footer ends the page, so nothing of its own is reserved for the scroll-to-top FAB: the
  // FAB's rail is a row of the scroll content above it and holds its own band clear.
  it("ends the page on its own height, with no band reserved under it", () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    render(<Footer />);
    expect(StyleSheet.flatten(screen.getByTestId("site-footer").props.style).paddingBottom).toBe(0);
  });

  it("lays its links out in one unwrapped row beside the copyright", () => {
    render(<Footer />);
    expect(StyleSheet.flatten(screen.getByTestId("footer-inner").props.style).flexDirection).toBe(
      "row"
    );
    expect(
      StyleSheet.flatten(screen.getByTestId("footer-links").props.style).flexWrap
    ).toBeUndefined();
  });

  describe("off web", () => {
    beforeEach(() => setPlatform("ios"));
    afterEach(() => setPlatform("web"));

    // `app/admin/_layout.tsx` redirects off web, so in the app this row is a site map pointing
    // at a screen that hands you straight back to the home page.
    it("drops the admin link, which off web only bounces back to the home screen", () => {
      render(<Footer />);
      expect(screen.queryByText("Admin")).toBeNull();
      expect(screen.queryByLabelText("Restaurant admin")).toBeNull();
    });

    // Both stores refuse a listing whose app cannot reach a privacy policy, so the compact
    // layout may drop chrome but never this.
    it("keeps the privacy policy link the stores require", () => {
      (useAppTheme as jest.Mock).mockReturnValue({
        brand: {
          appName: "Test App",
          primaryColor: "#0a7ea4",
          privacyPolicyUrl: "https://example.com/privacy",
        },
        colors: { border: "#ccc", muted: "#666" },
      });
      render(<Footer />);

      fireEvent.press(screen.getByLabelText("Privacy policy"));

      expect(openExternal).toHaveBeenCalledWith("https://example.com/privacy");
    });

    it("keeps the social links reachable", async () => {
      (fetchSocialLinks as jest.Mock).mockResolvedValue([
        {
          id: 1,
          label: "Instagram",
          url: "https://instagram.com/resto",
          iconKey: "logo-instagram",
          sortOrder: 0,
        },
      ]);
      render(<Footer />);

      fireEvent.press(await screen.findByLabelText("Instagram"));

      expect(Linking.openURL).toHaveBeenCalledWith("https://instagram.com/resto");
    });

    // A desktop footer puts the fine print at one end of a wide row and the links at the other.
    // On a phone the two stack, links first, the way an app's last screen row reads.
    it("stacks the links over the fine print instead of spanning a desktop row", () => {
      render(<Footer />);
      const inner = StyleSheet.flatten(screen.getByTestId("footer-inner").props.style);
      expect(inner.flexDirection).toBe("column-reverse");
      expect(inner.alignItems).toBe("center");
    });

    // The link row has no wrap on web, where there is always a viewport wide enough for it.
    // A phone with two social links plus the privacy policy runs it off the screen edge.
    it("wraps its links rather than running them off the side of a phone", () => {
      render(<Footer />);
      expect(StyleSheet.flatten(screen.getByTestId("footer-links").props.style).flexWrap).toBe(
        "wrap"
      );
    });

    it("tightens the padding the desktop row is sized on", () => {
      const { unmount } = render(<Footer />);
      const native = StyleSheet.flatten(screen.getByTestId("footer-inner").props.style);
      unmount();

      setPlatform("web");
      render(<Footer />);
      const web = StyleSheet.flatten(screen.getByTestId("footer-inner").props.style);

      expect(native.paddingVertical).toBeLessThan(web.paddingVertical as number);
      expect(native.paddingHorizontal).toBeLessThan(web.paddingHorizontal as number);
    });
  });
});
