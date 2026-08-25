import { useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ThemeColors } from "@/theme/theme";
import { CachedBooking } from "@/utils/bookingCache";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fmtMonthDay } from "@/utils/formatters";
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
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (cached.length === 0) return null;

  const overflowing = cached.length > COLLAPSED_COUNT;
  const visible = expanded || !overflowing ? cached : cached.slice(0, COLLAPSED_COUNT);

  return (
    <View style={[styles.section, style]}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>
        {t("lookup.recent.heading")}
      </ThemedText>
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
            accessibilityLabel={
              c.restaurantName
                ? t("lookup.recent.itemWithNameA11y", { ref: c.bookingRef, name: c.restaurantName })
                : t("lookup.recent.itemA11y", { ref: c.bookingRef })
            }
          >
            <View style={styles.cardRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <ThemedText style={styles.ref}>{c.bookingRef}</ThemedText>
                <ThemedText style={[styles.meta, { color: colors.muted }]}>
                  {c.restaurantName ? `${c.restaurantName} · ` : ""}
                  {fmtMonthDay(new Date(c.date))}
                  {" · "}
                  {t("lookup.recent.guestCount", { count: c.seats })}
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
          {expanded
            ? t("lookup.recent.showFewer")
            : t("lookup.recent.showAll", { count: cached.length })}
        </Button>
      )}

      <ThemedText style={[styles.storageNote, { color: colors.muted }]}>
        {t("lookup.recent.storageNote")}
      </ThemedText>
    </View>
  );
}
