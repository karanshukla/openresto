import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { WalkInSource, walkInDaysLabel } from "@/utils/walkIn";
import { styles } from "./WalkInDaysBanner.styles";
import { Icon } from "@/components/common/Icon";

/**
 * Fully walk-in locations skip the booking form entirely and show
 * `WalkInNotice` instead.
 */
export default function WalkInDaysBanner({ restaurant }: { restaurant: WalkInSource }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const daysLabel = walkInDaysLabel(restaurant);
  if (!daysLabel) return null;

  return (
    <View
      testID="walk-in-days-banner"
      style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Icon name="information-circle-outline" size="md" color={colors.muted} />
      <ThemedText style={[styles.text, { color: colors.muted }]}>
        {t("booking.walkIn.daysBanner", { days: daysLabel })}
      </ThemedText>
    </View>
  );
}
