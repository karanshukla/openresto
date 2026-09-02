import { Linking, Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { VENDOR_BRANDS } from "@/constants/vendorBrands";
import { APPLE_MAPS_SEARCH, GOOGLE_MAPS_SEARCH, openDirections } from "@/utils/directions";
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
 * in the neutral tone its achromatic mark asks for.
 *
 * Off web there is one pill, not two. A phone has a maps app already, and offering an Android
 * user Apple Maps hands them a web page; `openDirections` picks the one the OS opens natively.
 *
 * @see [DirectionsActions.test.tsx](../../tests/components/booking/DirectionsActions.test.tsx)
 * — pins both services on web and the single platform pill off it.
 */
export default function DirectionsActions({ address }: { address: string }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  const heading = (
    <ThemedText style={[styles.title, { color: colors.muted }]}>
      {t("booking.directions.heading")}
    </ThemedText>
  );

  if (Platform.OS !== "web") {
    return (
      <View style={styles.wrap}>
        {heading}
        <ButtonRow align="start">
          <Button
            testID="maps-open-btn"
            variant="secondary"
            size="sm"
            icon="navigate-outline"
            onPress={() => openDirections(address)}
          >
            {t("booking.directions.openMapsButton")}
          </Button>
        </ButtonRow>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {heading}
      <ButtonRow align="start">
        <Button
          testID="maps-google-btn"
          variant="secondary"
          size="sm"
          icon="logo-google"
          accentColor={VENDOR_BRANDS.google}
          onPress={() => openMaps(GOOGLE_MAPS_SEARCH, address)}
        >
          Google
        </Button>
        <Button
          testID="maps-apple-btn"
          variant="secondary"
          tone="neutral"
          size="sm"
          icon="logo-apple"
          onPress={() => openMaps(APPLE_MAPS_SEARCH, address)}
        >
          Apple
        </Button>
      </ButtonRow>
    </View>
  );
}
