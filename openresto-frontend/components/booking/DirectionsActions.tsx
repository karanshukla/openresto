import { Linking, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./DirectionsActions.styles";

function openMaps(base: string, address: string) {
  return Linking.openURL(`${base}${encodeURIComponent(address)}`);
}

/**
 * Get-directions buttons for Google and Apple Maps. Named pills at every width: a bare
 * navigate arrow beside a bare map glyph gives a sighted diner no way to tell which
 * service they're about to be handed to, and the sheet these sit in is not the kind of
 * constrained chrome that earns an icon-only control. Unlike the calendar actions above
 * them, these work on every platform — Linking.openURL isn't a web-only API — so they
 * render without a Platform.OS gate.
 */
export default function DirectionsActions({ address }: { address: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>GET DIRECTIONS</ThemedText>
      <View style={styles.row}>
        <Button
          testID="maps-google-btn"
          style={styles.btn}
          variant="secondary"
          tone="neutral"
          size="md"
          icon="navigate-outline"
          onPress={() => openMaps("https://maps.google.com/?q=", address)}
        >
          Google
        </Button>
        <Button
          testID="maps-apple-btn"
          style={styles.btn}
          variant="secondary"
          tone="neutral"
          size="md"
          icon="map-outline"
          onPress={() => openMaps("https://maps.apple.com/?q=", address)}
        >
          Apple
        </Button>
      </View>
    </View>
  );
}
