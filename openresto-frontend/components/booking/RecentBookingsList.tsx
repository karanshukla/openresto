import { useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ThemeColors } from "@/theme/theme";
import { CachedBooking } from "@/utils/bookingCache";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./RecentBookingsList.styles";

/** How many rows show before the list collapses behind a Show all control. */
export const COLLAPSED_COUNT = 5;

/**
 * The diner's own recently-viewed bookings (from the encrypted cookie), rendered once and
 * positioned by the caller's `style` rather than being mounted twice for narrow/wide layouts.
 */
export default function RecentBookingsList({
  cached,
  colors,
  style,
  activeRef = null,
  onSelect,
}: {
  cached: CachedBooking[];
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
  /** The booking currently open in the result panel, marked as the selected row. */
  activeRef?: string | null;
  onSelect: (c: CachedBooking) => void;
}) {
  const { primaryColor, isDark } = useAppTheme();
  const [expanded, setExpanded] = useState(false);

  if (cached.length === 0) return null;

  const overflowing = cached.length > COLLAPSED_COUNT;
  const visible = expanded || !overflowing ? cached : cached.slice(0, COLLAPSED_COUNT);

  return (
    <View style={[styles.section, style]}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>YOUR RECENT BOOKINGS</ThemedText>
      {visible.map((c) => {
        const isActive = c.bookingRef === activeRef;
        return (
          <Pressable
            key={c.bookingRef}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
              isActive && {
                borderColor: primaryColor,
                backgroundColor: isDark ? `${primaryColor}1A` : `${primaryColor}0D`,
              },
            ]}
            onPress={() => onSelect(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Look up booking ${c.bookingRef}${
              c.restaurantName ? ` at ${c.restaurantName}` : ""
            }`}
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <ThemedText style={styles.ref}>{c.bookingRef}</ThemedText>
                <ThemedText style={[styles.meta, { color: colors.muted }]}>
                  {c.restaurantName ? `${c.restaurantName} · ` : ""}
                  {new Date(c.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
                  {c.seats} guest{c.seats !== 1 ? "s" : ""}
                </ThemedText>
              </View>
              <Icon
                name={isActive ? "checkmark-circle" : "chevron-forward-outline"}
                size="md"
                color={isActive ? primaryColor : colors.muted}
              />
            </View>
          </Pressable>
        );
      })}

      {overflowing && (
        <Button
          variant="ghost"
          tone="neutral"
          size="sm"
          icon={expanded ? "chevron-up-outline" : "chevron-down-outline"}
          onPress={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show fewer" : `Show all ${cached.length}`}
        </Button>
      )}

      <ThemedText style={[styles.storageNote, { color: colors.muted }]}>
        Recent bookings are stored on this device. Clearing your cache and cookies, or uninstalling
        the app, will empty this list.
      </ThemedText>
    </View>
  );
}
