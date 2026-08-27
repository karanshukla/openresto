import { Image } from "expo-image";
import { Icon, resolveIconSize, type IconSize } from "@/components/common/Icon";
import { buildFaviconDataUri } from "@/constants/faviconIcons";

/**
 * The brand's chosen mark, drawn wherever the app stands for itself rather than for a screen.
 *
 * It renders the same Lucide glyph the favicon and PWA icon use, from the one source of truth in
 * `constants/faviconIcons`, rather than an Ionicons lookalike: four of the fifteen choices
 * (chef's hat, soup, cake, sandwich) have no Ionicons equivalent at all, so a mapping would quietly
 * show a different icon than the one the brand settings say is selected.
 *
 * A brand with no icon configured, or one naming an icon this build no longer ships, falls back to
 * the generic mark — `buildFaviconDataUri` returns nothing for an id it cannot resolve, so a stale
 * value degrades rather than rendering a blank tile.
 *
 * @see [BrandGlyph.test.tsx](../../tests/components/common/BrandGlyph.test.tsx) — pins that a
 * configured icon draws the brand's own mark and that an absent or unknown one falls back.
 */
export function BrandGlyph({
  iconId,
  size = "md",
  color,
}: {
  /** `BrandSettings.faviconIcon`; undefined when the brand has not chosen one. */
  iconId?: string;
  size?: IconSize | number;
  color: string;
}) {
  const uri = iconId ? buildFaviconDataUri(iconId, color) : "";
  if (!uri) return <Icon name="restaurant-outline" size={size} color={color} />;

  const px = resolveIconSize(size);
  return (
    <Image
      source={{ uri }}
      style={{ width: px, height: px }}
      contentFit="contain"
      accessible={false}
      testID="brand-glyph"
    />
  );
}
