import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { WalkInSource, walkInDaysLabel } from "@/utils/walkIn";
import { styles } from "./WalkInDaysBanner.styles";

/**
 * Fully walk-in locations skip the booking form entirely and show
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
        Walk-ins only on {daysLabel} - online booking isn&apos;t available on those days.
      </ThemedText>
    </View>
  );
}
