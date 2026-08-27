import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { fmtDate } from "@/utils/formatters";
import { styles } from "./bookings.styles";

/**
 * Day navigation for the views drawn from the grid fetch. Shared rather than duplicated because the
 * timetable and the service view move through the same `gridDate`, and a second copy would let the
 * two drift apart on a screen where they are one toggle away from each other.
 */
export function GridDateBar({
  date,
  onChangeDay,
  onResetToToday,
  borderColor,
  primaryColor,
}: {
  date: Date;
  onChangeDay: (delta: number) => void;
  onResetToToday: () => void;
  borderColor: string;
  primaryColor: string;
}) {
  const { t } = useTranslation();
  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <View style={[styles.gridDateBar, { borderBottomColor: borderColor }]}>
      <Pressable
        testID="grid-nav-prev"
        style={styles.gridNavBtn}
        onPress={() => onChangeDay(-1)}
        accessibilityRole="button"
        accessibilityLabel={t("admin.bookings.timetable.previousDay")}
      >
        <Icon name="chevron-back" size="lg" color={primaryColor} />
      </Pressable>
      <Pressable
        onPress={onResetToToday}
        style={styles.gridDateLabel}
        accessibilityRole="button"
        accessibilityLabel={t("admin.bookings.timetable.jumpToTodayLabel", { date: fmtDate(date) })}
      >
        <ThemedText style={styles.gridDateText}>{fmtDate(date)}</ThemedText>
        {!isToday && (
          <ThemedText style={[styles.gridTodayHint, { color: primaryColor }]}>
            {t("admin.bookings.timetable.tapForToday")}
          </ThemedText>
        )}
      </Pressable>
      <Pressable
        testID="grid-nav-next"
        style={styles.gridNavBtn}
        onPress={() => onChangeDay(1)}
        accessibilityRole="button"
        accessibilityLabel={t("admin.bookings.timetable.nextDay")}
      >
        <Icon name="chevron-forward" size="lg" color={primaryColor} />
      </Pressable>
    </View>
  );
}
