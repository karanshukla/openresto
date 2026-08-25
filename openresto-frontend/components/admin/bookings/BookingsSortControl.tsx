import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import { styles } from "@/components/admin/bookings/bookings.styles";
import type { SortKey, SortState } from "@/components/admin/bookings/sorting";
import { Icon } from "@/components/common/Icon";

export interface BookingsSortControlProps {
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  /** Theme values passed from the orchestrating screen (presentational). */
  borderColor: string;
  cardBg: string;
  mutedColor: string;
  primaryColor: string;
}

function columnsFor(t: TFunction): { key: SortKey; label: string }[] {
  return [
    { key: "date", label: t("admin.bookings.sort.time") },
    { key: "guest", label: t("admin.bookings.sort.guest") },
    { key: "seats", label: t("admin.bookings.sort.party") },
    { key: "table", label: t("booking.form.tableLabel") },
    { key: "status", label: t("admin.bookings.sort.status") },
  ];
}

/**
 * Sort affordance for the mobile card list — column headers don't apply to a
 * card layout, so this offers the same sort axes as the wide table via a row of
 * chips, each with a direction toggle (tap the active chip to flip asc/desc).
 * Presentational; the screen owns the sort state.
 */
export function BookingsSortControl({
  sort,
  onSortChange,
  borderColor,
  cardBg,
  mutedColor,
  primaryColor,
}: BookingsSortControlProps) {
  const { t } = useTranslation();
  const columns = columnsFor(t);
  return (
    <View style={[styles.sortControl, { borderColor, backgroundColor: cardBg }]}>
      <ThemedText style={[styles.sortControlLabel, { color: mutedColor }]}>
        {t("admin.bookings.sort.sortLabel")}
      </ThemedText>
      <View style={styles.sortControlChips}>
        {columns.map(({ key, label }) => {
          const isActive = sort.key === key;
          const dirLabel = isActive
            ? sort.dir === "asc"
              ? t("admin.bookings.sort.ascending")
              : t("admin.bookings.sort.descending")
            : t("admin.bookings.sort.notSorted");
          return (
            <Pressable
              key={key}
              testID={`sort-chip-${key}`}
              accessibilityRole="button"
              accessibilityLabel={t("admin.bookings.sort.ariaLabel", {
                column: label,
                direction: dirLabel,
              })}
              style={[
                styles.sortChip,
                { borderColor: isActive ? primaryColor : borderColor },
                isActive && { backgroundColor: primaryColor },
              ]}
              onPress={() => onSortChange(key)}
            >
              <ThemedText
                style={[
                  styles.sortChipText,
                  { color: isActive ? "#fff" : mutedColor },
                  isActive && styles.sortChipTextActive,
                ]}
              >
                {label}
              </ThemedText>
              <Icon
                name={
                  !isActive
                    ? "swap-vertical-outline"
                    : sort.dir === "asc"
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                }
                size={11}
                color={isActive ? "#fff" : mutedColor}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
