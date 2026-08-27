import React from "react";
import { render, screen } from "@testing-library/react-native";
import { BrandGlyph } from "@/components/common/BrandGlyph";
import { FAVICON_ICONS } from "@/constants/faviconIcons";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});

describe("BrandGlyph", () => {
  it("draws the brand's own mark when one is configured", () => {
    render(<BrandGlyph iconId="wine" color="#fff" />);

    const glyph = screen.getByTestId("brand-glyph");
    expect(glyph.props.source.uri).toContain("svg");
  });

  it("draws the mark in the colour it was given, so it reads on a brand-coloured tile", () => {
    render(<BrandGlyph iconId="wine" color="#ffffff" />);

    expect(decodeURIComponent(screen.getByTestId("brand-glyph").props.source.uri)).toContain(
      'stroke="#ffffff"'
    );
  });

  // Four of the fifteen choices have no Ionicons equivalent, so the real glyph is drawn rather
  // than a lookalike — this pins that every choice actually resolves to one.
  it("resolves every icon the brand settings offer", () => {
    for (const icon of FAVICON_ICONS) {
      const view = render(<BrandGlyph iconId={icon.id} color="#fff" />);
      expect(screen.getByTestId("brand-glyph")).toBeTruthy();
      view.unmount();
    }
  });

  it("falls back to the generic mark when the brand has chosen no icon", () => {
    render(<BrandGlyph color="#fff" />);
    expect(screen.queryByTestId("brand-glyph")).toBeNull();
  });

  it("falls back rather than drawing a blank tile for an icon this build no longer ships", () => {
    render(<BrandGlyph iconId="tractor" color="#fff" />);
    expect(screen.queryByTestId("brand-glyph")).toBeNull();
  });

  it("sizes the mark to the icon scale it was asked for", () => {
    render(<BrandGlyph iconId="wine" color="#fff" size={24} />);
    expect(screen.getByTestId("brand-glyph").props.style).toMatchObject({
      width: 24,
      height: 24,
    });
  });
});
