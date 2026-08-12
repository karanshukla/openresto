import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { ThemedText } from "@/components/themed-text";
import type { RgbColor } from "@/utils/colors";
import { styles } from "./LocationListItem.styles";

export interface LocationThumbnailProps {
  name: string;
  imageUrl?: string | null;
  size: number;
  /** Phone-width layout: the fallback initial shrinks with the tile. */
  compact?: boolean;
  /** Brand accent, already parsed — the no-image fallback is a dark ramp built from it. */
  accent: RgbColor;
}

const ramp = ({ r, g, b }: RgbColor, factor: number, blueFactor: number) =>
  `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * blueFactor)})`;

/**
 * The square at the head of a location row. With an image it renders as a CSS background on
 * web (avoiding a second network fetch through expo-image) and an `<Image>` on native; with
 * none it falls back to a brand-tinted gradient behind the location's initial.
 */
export function LocationThumbnail({
  name,
  imageUrl,
  size,
  compact = false,
  accent,
}: LocationThumbnailProps) {
  const [imageError, setImageError] = useState(false);

  const fill = imageUrl
    ? Platform.OS === "web"
      ? ({
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } as object)
      : { backgroundColor: "#111" }
    : Platform.OS === "web"
      ? ({
          background: `linear-gradient(145deg,
                    ${ramp(accent, 0.1, 0.13)} 0%,
                    ${ramp(accent, 0.38, 0.42)} 55%,
                    ${ramp(accent, 0.6, 0.65)} 100%)`,
        } as object)
      : { backgroundColor: ramp(accent, 0.15, 0.18) };

  return (
    <View style={[styles.thumb, { width: size, height: size }, fill]}>
      {imageUrl && Platform.OS !== "web" && !imageError && (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setImageError(true)}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {!imageUrl && (
        <ThemedText style={[styles.thumbInitial, compact && styles.thumbInitialCompact]}>
          {name.charAt(0).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}

export default LocationThumbnail;
