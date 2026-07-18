import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { RestaurantDto } from "@/api/restaurants";
import { getHoursForDay, parseOpenDays } from "@/utils/openingHours";
import { isWalkInOnlyOnDay } from "@/utils/walkIn";
import { getRestaurantNow } from "@/utils/restaurantTime";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Full 7-day opening-hours table for a location. Today's row is highlighted; days
 * outside `openDays` read "Closed"; walk-in-only days show a small badge. All data
 * (`openHours`, `openDays`, walk-in policy) already lives on `RestaurantDto` —
 * this is a rendering component, no backend dependency.
 */
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
                  <Ionicons name="walk-outline" size={10} color={colors.muted} />
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

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 11,
    position: "relative",
  },
  dayCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  todayBar: {
    position: "absolute",
    left: -theme.spacing.lg,
    top: "50%",
    marginTop: -9,
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  dayText: {
    fontSize: 14,
  },
  hoursCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hoursText: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  closedText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  walkInBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  walkInText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
