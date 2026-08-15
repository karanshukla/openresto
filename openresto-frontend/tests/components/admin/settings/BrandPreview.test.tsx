/**
 * @jest-environment jsdom
 */
import React from "react";
import { Platform } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { BrandPreview } from "@/components/admin/settings/BrandPreview";
import {
  BrandDraftProvider,
  useBrandDraftPublish,
  type BrandDraft,
} from "@/components/admin/settings/BrandDraftContext";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

let mockBrandData: Record<string, unknown> = {
  primaryColor: "#0a7ea4",
  appName: "Open Resto",
};

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockBrandData,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  cardBg: "#fff",
};

/** Stands in for a settings card: publishes one edit into the draft, renders nothing. */
function Publisher({ values }: { values: Partial<BrandDraft> }) {
  useBrandDraftPublish(values);
  return null;
}

function renderWithDraft(values?: Partial<BrandDraft>) {
  return render(
    <BrandDraftProvider>
      {values && <Publisher values={values} />}
      <BrandPreview {...baseProps} />
    </BrandDraftProvider>
  );
}

describe("BrandPreview", () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBrandData = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it("renders the preview frame with the app name in the browser tab", () => {
    renderWithDraft();
    expect(screen.getByTestId("brand-preview-frame")).toBeTruthy();
    // Once in the tab, once as the hero title.
    expect(screen.getAllByText("Open Resto").length).toBeGreaterThan(1);
  });

  it("falls back to the home page's default subtitle when none is set", () => {
    renderWithDraft();
    expect(screen.getByText(/Scroll down to pick a location below/)).toBeTruthy();
  });

  it("shows an unsaved subtitle as soon as a card publishes it", () => {
    renderWithDraft({ subtitle: "Best pizza in town" });
    expect(screen.getByText("Best pizza in town")).toBeTruthy();
    expect(screen.queryByText(/Scroll down to pick a location below/)).toBeNull();
  });

  it("shows an unsaved app name in both the tab and the hero", () => {
    renderWithDraft({ appName: "Trattoria" });
    expect(screen.getAllByText("Trattoria").length).toBe(2);
  });

  it("shows the website URL in the address bar without its scheme", () => {
    renderWithDraft({ websiteUrl: "https://bookings.example.com" });
    expect(screen.getByText("bookings.example.com")).toBeTruthy();
  });

  it("falls back to a placeholder host when no website URL is set", () => {
    renderWithDraft();
    expect(screen.getByText("your-site.example")).toBeTruthy();
  });

  it("hides the highlights section until there are highlights", () => {
    renderWithDraft();
    expect(screen.queryByText("Restaurant highlights")).toBeNull();
  });

  it("renders published highlights under the default heading", () => {
    renderWithDraft({
      highlights: [{ id: 1, title: "Wood-fired", body: "Fresh daily", iconKey: "flame-outline" }],
    });
    expect(screen.getByText("Restaurant highlights")).toBeTruthy();
    expect(screen.getByText("Curated by the owner")).toBeTruthy();
    expect(screen.getByText("Wood-fired")).toBeTruthy();
  });

  it("caps the highlights row at three cards", () => {
    renderWithDraft({
      highlights: [1, 2, 3, 4].map((id) => ({
        id,
        title: `Highlight ${id}`,
        body: "",
        iconKey: "star-outline",
      })),
    });
    expect(screen.getByText("Highlight 3")).toBeTruthy();
    expect(screen.queryByText("Highlight 4")).toBeNull();
  });

  it("uses the published highlights heading over the default", () => {
    renderWithDraft({
      highlightsHeading: "Why visit us",
      highlights: [{ id: 1, title: "One", body: "", iconKey: "star-outline" }],
    });
    expect(screen.getByText("Why visit us")).toBeTruthy();
  });

  it("renders the stand-in locations", () => {
    renderWithDraft();
    expect(screen.getByText("Our locations")).toBeTruthy();
    expect(screen.getByText("Riverside")).toBeTruthy();
    expect(screen.getAllByText("Book").length).toBe(3);
  });

  it("falls back to a generated copyright line", () => {
    renderWithDraft();
    const year = new Date().getFullYear();
    expect(screen.getByText(`© ${year} Open Resto. All rights reserved.`)).toBeTruthy();
  });

  it("shows published copyright text and social links in the footer", () => {
    renderWithDraft({
      copyrightText: "© Trattoria",
      socialLinks: [{ id: 1, label: "Instagram", iconKey: "logo-instagram" }],
    });
    expect(screen.getByText("© Trattoria")).toBeTruthy();
    expect(screen.getByText("Instagram")).toBeTruthy();
  });

  it("collapses and expands when its header chevron is pressed", () => {
    renderWithDraft();
    expect(screen.getByTestId("brand-preview-frame")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Live preview"));
    expect(screen.queryByTestId("brand-preview-frame")).toBeNull();
    fireEvent.press(screen.getByLabelText("Live preview"));
    expect(screen.getByTestId("brand-preview-frame")).toBeTruthy();
  });

  it("switches the previewed site between light and dark independently of the admin", () => {
    renderWithDraft();
    const dark = screen.getByLabelText("Preview in dark mode");
    expect(dark.props.accessibilityState.checked).toBe(false);
    act(() => {
      fireEvent.press(dark);
    });
    expect(screen.getByLabelText("Preview in dark mode").props.accessibilityState.checked).toBe(
      true
    );
    expect(screen.getByLabelText("Preview in light mode").props.accessibilityState.checked).toBe(
      false
    );
  });

  it("reads saved brand values when rendered without a draft provider", () => {
    mockBrandData = {
      primaryColor: "#0a7ea4",
      appName: "Saved Name",
      subtitle: "Saved tagline",
    };
    render(<BrandPreview {...baseProps} />);
    expect(screen.getByText("Saved tagline")).toBeTruthy();
    expect(screen.getAllByText("Saved Name").length).toBe(2);
  });

  // Raw web <img> forwards `data-testid` not `testID`, so these query via UNSAFE_getByProps.
  // The hero image is web-only, mirroring the home page's own Platform gate.
  it("renders the header image over the hero when one is published", () => {
    Platform.OS = "web";
    renderWithDraft({ headerImageUrl: "https://example.com/hero.jpg" });
    const hero = screen.UNSAFE_getByProps({ "data-testid": "brand-preview-hero-image" });
    expect(hero.props.src).toBe("https://example.com/hero.jpg");
    expect(hero.props.style.objectFit).toBe("cover");
  });

  it("switches the header image to contain when that fit is published", () => {
    Platform.OS = "web";
    renderWithDraft({
      headerImageUrl: "https://example.com/hero.jpg",
      headerImageFit: "Contain",
    });
    const hero = screen.UNSAFE_getByProps({ "data-testid": "brand-preview-hero-image" });
    expect(hero.props.style.objectFit).toBe("contain");
    expect(hero.props.style.objectPosition).toBe("center top");
  });

  it("renders the favicon in the browser tab when one is selected", () => {
    renderWithDraft({ faviconIcon: "utensils" });
    const favicon = screen.UNSAFE_getByProps({ "data-testid": "brand-preview-favicon" });
    expect(favicon.props.src.startsWith("data:image/svg")).toBe(true);
  });
});
