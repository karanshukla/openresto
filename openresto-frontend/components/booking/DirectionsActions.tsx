import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { VENDOR_BRANDS } from "@/constants/vendorBrands";
import { styles } from "./DirectionsActions.styles";

function openMaps(base: string, address: string) {
  return Linking.openURL(`${base}${encodeURIComponent(address)}`);
}

/**
 * Get-directions pills for Google and Apple Maps. Named at every width: a bare navigate
 * arrow beside a bare map glyph gives a sighted diner no way to tell which service they're
 * about to be handed to, and the sheet these sit in is not the kind of constrained chrome
 * that earns an icon-only control. The heading already says "directions", so the glyph is
 * free to say *whose* — each pill wears its service's logo, Google in its own blue and Apple
 * in the neutral tone its achromatic mark asks for. Like the calendar actions above them,
 * these render on every platform: Linking.openURL hands the address to whichever map app the
 * OS has, and to a new tab on web.
 */
export default function DirectionsActions({ address }: { address: string }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.wrap}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>
        {t("booking.directions.heading")}
      </ThemedText>
      <ButtonRow align="start">
        <Button
          testID="maps-google-btn"
          variant="secondary"
          size="sm"
          icon="logo-google"
          accentColor={VENDOR_BRANDS.google}
          onPress={() => openMaps("https://maps.google.com/?q=", address)}
        >
          Google
        </Button>
        <Button
          testID="maps-apple-btn"
          variant="secondary"
          tone="neutral"
          size="sm"
          icon="logo-apple"
          onPress={() => openMaps("https://maps.apple.com/?q=", address)}
        >
          Apple
        </Button>
      </ButtonRow>
    </View>
  );
}
