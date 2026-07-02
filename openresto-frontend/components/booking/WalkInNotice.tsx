import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useBrand } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, getThemeColors } from "@/theme/theme";

/**
 * Friendly banner shown wherever the booking flow is disabled because a
 * location (scope="location") or the selected day (scope="day") is walk-in
 * only. Replaces the booking CTA rather than hiding the location.
 */
export default function WalkInNotice({
  scope,
  daysLabel,
}: {
  scope: "location" | "day";
  /** e.g. "Saturdays and Sundays" — names the walk-in days for a more specific message. */
  daysLabel?: string;
}) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  const accentHex = primaryColor.replace("#", "");
  const r = parseInt(accentHex.slice(0, 2), 16);
  const g = parseInt(accentHex.slice(2, 4), 16);
  const b = parseInt(accentHex.slice(4, 6), 16);
  const accentSoft = `rgba(${r},${g},${b},0.10)`;
  const accentBorder = `rgba(${r},${g},${b},0.28)`;

  const title = scope === "location" ? "Walk-ins only" : "Walk-ins only on this day";
  const body =
    scope === "location"
      ? "This location doesn't take online bookings. Tables are first come, first served. Just drop by during opening hours."
      : daysLabel
        ? `This location doesn't take online bookings on ${daysLabel}. Pick another day, or simply come in — walk-ins are always welcome.`
        : "Online booking isn't available for the selected date. Pick another day, or simply come in. Walk-ins are always welcome.";

  return (
    <View
      testID="walk-in-notice"
      style={[styles.card, { backgroundColor: accentSoft, borderColor: accentBorder }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: primaryColor }]}>
        <Ionicons name="walk-outline" size={20} color="#fff" />
      </View>
      <View style={styles.textWrap}>
        <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
        <ThemedText style={[styles.body, { color: colors.muted }]}>{body}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
});
