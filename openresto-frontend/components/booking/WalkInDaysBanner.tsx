import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { WalkInSource, walkInDaysLabel } from "@/utils/walkIn";

/**
 * Persistent heads-up shown on the booking page for locations that only
 * take walk-ins on specific days (e.g. "Fridays and Saturdays"), so
 * customers know upfront — before picking a date — that those days aren't
 * bookable online. Renders nothing for locations without custom walk-in
 * days; fully walk-in locations skip the booking form entirely and show
 * `WalkInNotice` instead.
 */
export default function WalkInDaysBanner({ restaurant }: { restaurant: WalkInSource }) {
  const { colors } = useAppTheme();
  const daysLabel = walkInDaysLabel(restaurant);
  if (!daysLabel) return null;

  return (
    <View
      testID="walk-in-days-banner"
      style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
      <ThemedText style={[styles.text, { color: colors.muted }]}>
        Walk-ins only on {daysLabel} — online booking isn&apos;t available on those days.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  text: {
    fontSize: 12.5,
    flex: 1,
    lineHeight: 17,
  },
});
