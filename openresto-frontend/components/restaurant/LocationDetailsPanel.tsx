import { Linking, Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { LinkedText } from "@/components/common/LinkedText";
import OpeningHoursTable from "@/components/restaurant/OpeningHoursTable";
import WalkInNotice from "@/components/booking/WalkInNotice";
import type { RestaurantDto } from "@/api/restaurants";
import { LocationSeatingMap } from "./LocationSeatingMap";
import { styles } from "./LocationListItem.styles";

export interface LocationDetailsPanelProps {
  restaurant: RestaurantDto;
  /** True for a location that never takes online bookings, which earns the standing notice. */
  walkInLocation: boolean;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  surface2: string;
  accentSoft: string;
  accentBorder: string;
}

function MapLink({
  label,
  url,
  mutedColor,
  borderColor,
  primaryColor,
  surface2,
}: {
  label: string;
  url: string;
  mutedColor: string;
  borderColor: string;
  primaryColor: string;
  surface2: string;
}) {
  return (
    <Pressable
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.mapLink,
        {
          backgroundColor: surface2,
          borderColor: hovered || pressed ? primaryColor : borderColor,
        },
      ]}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Open in ${label}`}
    >
      <Icon name="navigate-outline" size="xs" color={mutedColor} />
      <ThemedText style={[styles.mapLinkText, { color: mutedColor }]}>{label}</ThemedText>
    </Pressable>
  );
}

/** Everything a location row hides behind its Details accordion. */
export function LocationDetailsPanel({
  restaurant,
  walkInLocation,
  isDark,
  borderColor,
  mutedColor,
  primaryColor,
  surface2,
  accentSoft,
  accentBorder,
}: LocationDetailsPanelProps) {
  const tags = restaurant.tags ?? [];
  const mapLinkTheme = { mutedColor, borderColor, primaryColor, surface2 };

  return (
    <View style={[styles.expandedBody, { borderTopColor: borderColor }]}>
      {restaurant.description ? (
        <LinkedText text={restaurant.description} style={styles.description} />
      ) : null}

      {tags.length > 0 && (
        <View style={styles.tags}>
          {tags.map((t) => (
            <View
              key={t}
              style={[styles.tag, { backgroundColor: accentSoft, borderColor: accentBorder }]}
            >
              <ThemedText style={[styles.tagText, { color: primaryColor }]}>{t}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {restaurant.menuUrl ? (
        <Pressable
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
            styles.menuButton,
            {
              backgroundColor: hovered || pressed ? accentSoft : surface2,
              borderColor: hovered || pressed ? accentBorder : borderColor,
            },
          ]}
          onPress={() => Linking.openURL(restaurant.menuUrl!)}
          accessibilityRole="link"
          accessibilityLabel="Open menu"
        >
          <Icon name="document-text-outline" size="md" color={primaryColor} />
          <ThemedText style={[styles.menuButtonText, { color: primaryColor }]}>
            View menu
          </ThemedText>
          <Icon name="open-outline" size={13} color={mutedColor} style={styles.menuButtonEnd} />
        </Pressable>
      ) : null}

      {restaurant.address && (
        <View style={styles.mapLinks}>
          <MapLink
            label="Google Maps"
            url={`https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`}
            {...mapLinkTheme}
          />
          <MapLink
            label="Apple Maps"
            url={`https://maps.apple.com/?q=${encodeURIComponent(restaurant.address)}`}
            {...mapLinkTheme}
          />
        </View>
      )}

      <View style={styles.subSection}>
        <ThemedText type="defaultSemiBold" style={styles.subHeading}>
          Opening hours
        </ThemedText>
        <OpeningHoursTable restaurant={restaurant} />
      </View>

      {walkInLocation && <WalkInNotice scope="location" />}

      <LocationSeatingMap
        restaurant={restaurant}
        isDark={isDark}
        borderColor={borderColor}
        mutedColor={mutedColor}
        primaryColor={primaryColor}
      />
    </View>
  );
}

export default LocationDetailsPanel;
