import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import type { BookingStatusFilter } from "@/api/admin";
import { styles } from "./bookings.styles";

/**
 * Which set of bookings the list shows. It belongs to the list rather than to the screen's
 * toolbar: the grid fetch ignores it entirely, so a toolbar that carried it had to drop it in the
 * timetable and service views, and a control appearing and vanishing beside the view toggle reads
 * as the toolbar rearranging itself rather than as a filter that only applies to one view.
 */
export function BookingStatusTabs({
  value,
  onChange,
  borderColor,
  cardBg,
  mutedColor,
  primaryColor,
}: {
  value: BookingStatusFilter;
  onChange: (value: BookingStatusFilter) => void;
  borderColor: string;
  cardBg: string;
  mutedColor: string;
  primaryColor: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={[styles.modeToggle, styles.statusTabs, { borderColor, backgroundColor: cardBg }]}>
      {(
        [
          { key: "active", label: t("admin.bookings.tabs.active"), color: primaryColor },
          { key: "past", label: t("admin.bookings.tabs.past"), color: "#7c3aed" },
          {
            key: "cancelled",
            label: t("admin.bookings.tabs.cancelled"),
            color: theme.status.cancelled.text,
          },
        ] as const
      ).map(({ key, label, color }) => (
        <Pressable
          key={key}
          testID={`status-tab-${key}`}
          style={[styles.modeBtn, value === key && { backgroundColor: color }]}
          onPress={() => onChange(key)}
          accessibilityRole="radio"
          accessibilityLabel={t("admin.bookings.tabs.showLabel", { tab: label.toLowerCase() })}
          accessibilityState={{ checked: value === key }}
        >
          <ThemedText style={[styles.modeBtnText, { color: value === key ? "#fff" : mutedColor }]}>
            {label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}
