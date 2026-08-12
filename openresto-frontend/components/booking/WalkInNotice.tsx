import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgb } from "@/utils/colors";
import { styles } from "./WalkInNotice.styles";

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
  const { colors, primaryColor } = useAppTheme();

  const { r, g, b } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${r},${g},${b},0.10)`;
  const accentBorder = `rgba(${r},${g},${b},0.28)`;

  const title = scope === "location" ? "Walk-ins only" : "Walk-ins only on this day";
  const body =
    scope === "location"
      ? "This location doesn't take online bookings. Tables are first come, first served. Just drop by during opening hours."
      : daysLabel
        ? `This location doesn't take online bookings on ${daysLabel}. Pick another day, or simply come in - walk-ins are always welcome.`
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
