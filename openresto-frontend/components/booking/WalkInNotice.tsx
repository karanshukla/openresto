import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgb } from "@/utils/colors";
import { styles } from "./WalkInNotice.styles";
import { Icon } from "@/components/common/Icon";

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
  const { t } = useTranslation();

  const { r, g, b } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${r},${g},${b},0.10)`;
  const accentBorder = `rgba(${r},${g},${b},0.28)`;

  const title =
    scope === "location" ? t("booking.walkIn.locationTitle") : t("booking.walkIn.dayTitle");
  const body =
    scope === "location"
      ? t("booking.walkIn.locationBody")
      : daysLabel
        ? t("booking.walkIn.dayBodyWithDays", { days: daysLabel })
        : t("booking.walkIn.dayBodyGeneric");

  return (
    <View
      testID="walk-in-notice"
      style={[styles.card, { backgroundColor: accentSoft, borderColor: accentBorder }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: primaryColor }]}>
        <Icon name="walk-outline" size="xl" color="#fff" />
      </View>
      <View style={styles.textWrap}>
        <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
        <ThemedText style={[styles.body, { color: colors.muted }]}>{body}</ThemedText>
      </View>
    </View>
  );
}
