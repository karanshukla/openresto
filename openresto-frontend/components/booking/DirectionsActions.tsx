import { Linking, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { IconButton } from "@/components/common/IconButton";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./DirectionsActions.styles";

function openMaps(base: string, address: string) {
  return Linking.openURL(`${base}${encodeURIComponent(address)}`);
}

/**
 * Get-directions buttons for Google and Apple Maps. One implementation for both the
 * compact icon-strip and the wide labelled layout, instead of the two independently
 * duplicated versions lookup.tsx used to carry. Unlike the calendar actions beside it,
 * this works on every platform — Linking.openURL isn't a web-only API — so it renders
 * without a Platform.OS gate.
 */
export default function DirectionsActions({
  address,
  compact,
}: {
  address: string;
  compact: boolean;
}) {
  const { colors } = useAppTheme();

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <ThemedText style={[styles.compactTitle, { color: colors.muted }]}>MAPS</ThemedText>
        <View style={styles.compactRow}>
          <IconButton
            testID="maps-google-btn"
            name="navigate-outline"
            size="lg"
            color={colors.muted}
            accessibilityLabel="Open in Google Maps"
            onPress={() => openMaps("https://maps.google.com/?q=", address)}
          />
          <IconButton
            testID="maps-apple-btn"
            name="map-outline"
            size="lg"
            color={colors.muted}
            accessibilityLabel="Open in Apple Maps"
            onPress={() => openMaps("https://maps.apple.com/?q=", address)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wideWrap}>
      <ThemedText style={[styles.wideTitle, { color: colors.muted }]}>GET DIRECTIONS</ThemedText>
      <View style={styles.wideRow}>
        <Button
          style={styles.wideBtn}
          variant="secondary"
          tone="neutral"
          size="md"
          icon="navigate-outline"
          onPress={() => openMaps("https://maps.google.com/?q=", address)}
        >
          Google
        </Button>
        <Button
          style={styles.wideBtn}
          variant="secondary"
          tone="neutral"
          size="md"
          icon="navigate-outline"
          onPress={() => openMaps("https://maps.apple.com/?q=", address)}
        >
          Apple
        </Button>
      </View>
    </View>
  );
}
