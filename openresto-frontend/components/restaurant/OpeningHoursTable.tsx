import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { RestaurantDto } from "@/api/restaurants";
import { getHoursForDay, parseOpenDays } from "@/utils/openingHours";
import { isWalkInOnlyOnDay } from "@/utils/walkIn";
import { getRestaurantNow } from "@/utils/restaurantTime";
import { styles } from "./OpeningHoursTable.styles";
import { Icon } from "@/components/common/Icon";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function OpeningHoursTable({ restaurant }: { restaurant: RestaurantDto }) {
  const { colors, isDark, primaryColor } = useAppTheme();
  const openDays = parseOpenDays(restaurant.openDays);
  const todayIsoDay = getRestaurantNow(restaurant.timezone || "UTC").isoDay;

  return (
    <ThemedView
      style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {DAY_LABELS.map((label, idx) => {
        const isoDay = idx + 1;
        const { open, close } = getHoursForDay(restaurant, isoDay);
        const isOpenDay = openDays.includes(isoDay);
        const isToday = isoDay === todayIsoDay;
        const walkInToday = isWalkInOnlyOnDay(restaurant, isoDay);

        return (
          <View
            key={isoDay}
            style={[
              styles.row,
              isToday && {
                backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
              },
              idx < DAY_LABELS.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.dayCell}>
              {isToday && <View style={[styles.todayBar, { backgroundColor: primaryColor }]} />}
              <ThemedText
                style={[
                  styles.dayText,
                  isToday && { color: primaryColor, fontWeight: "700" },
                  !isOpenDay && { opacity: 0.55 },
                ]}
              >
                {label}
                {isToday ? "  (today)" : ""}
              </ThemedText>
            </View>

            <View style={styles.hoursCell}>
              {isOpenDay ? (
                <ThemedText
                  style={[
                    styles.hoursText,
                    isToday && { color: colors.text, fontWeight: "600" },
                    !isToday && { color: colors.muted },
                  ]}
                >
                  {open} – {close}
                </ThemedText>
              ) : (
                <ThemedText style={[styles.closedText, { color: colors.muted }]}>Closed</ThemedText>
              )}

              {walkInToday && (
                <View
                  style={[
                    styles.walkInBadge,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon name="walk-outline" size={10} color={colors.muted} />
                  <ThemedText style={[styles.walkInText, { color: colors.muted }]}>
                    Walk-in
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </ThemedView>
  );
}
