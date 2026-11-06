import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { RestaurantDto } from "@/api/restaurants";
import { getHoursForDay, getLastBookingForDay, parseOpenDays } from "@/utils/openingHours";
import { isWalkInOnlyOnDay } from "@/utils/walkIn";
import { upcomingDateExceptions } from "@/utils/dateExceptions";
import { getRestaurantDate, getRestaurantNow } from "@/utils/restaurantTime";
import { fmtDateString } from "@/utils/formatters";
import type { DateExceptionDto } from "@/api/restaurants";
import { styles } from "./OpeningHoursTable.styles";
import { Icon } from "@/components/common/Icon";

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** How many dates that depart from the week the guest is shown; the admin can plan a year ahead. */
const UPCOMING_DATES_SHOWN = 6;

/**
 * The weekly hours, followed by the dates that depart from them (#521) so a guest sees the bank
 * holiday closure or the special service before the booking form has to refuse the date.
 *
 * @see [OpeningHoursTable.test.tsx](../../tests/components/restaurant/OpeningHoursTable.test.tsx)
 * — pins that upcoming dates are listed with what happens on them and past ones are not.
 */
export default function OpeningHoursTable({ restaurant }: { restaurant: RestaurantDto }) {
  const { colors, isDark, primaryColor } = useAppTheme();
  const { t } = useTranslation();
  const openDays = parseOpenDays(restaurant.openDays);
  const todayIsoDay = getRestaurantNow(restaurant.timezone || "UTC").isoDay;
  const upcomingDates = upcomingDateExceptions(
    restaurant,
    getRestaurantDate(restaurant.timezone || "UTC")
  ).slice(0, UPCOMING_DATES_SHOWN);

  const dateDetail = (entry: DateExceptionDto): string => {
    switch (entry.type) {
      case "closed":
        return t("restaurant.openingHours.dateClosed");
      case "walkInOnly":
        return t("restaurant.openingHours.dateWalkIn");
      case "specialHours":
        return `${entry.open} – ${entry.close}`;
    }
  };

  return (
    <>
      <ThemedView
        style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {DAY_KEYS.map((dayKey, idx) => {
          const label = t(`restaurant.openingHours.${dayKey}`);
          const isoDay = idx + 1;
          const { open, close } = getHoursForDay(restaurant, isoDay);
          const isOpenDay = openDays.includes(isoDay);
          const isToday = isoDay === todayIsoDay;
          const walkInToday = isWalkInOnlyOnDay(restaurant, isoDay);
          // The hours stay the real hours; the cutoff is a second line, and only where a guest
          // could book online at all.
          const lastBooking =
            isOpenDay && !walkInToday ? getLastBookingForDay(restaurant, isoDay) : null;

          return (
            <View
              key={isoDay}
              style={[
                styles.row,
                isToday && {
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
                },
                idx < DAY_KEYS.length - 1 && {
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
                  {isToday ? t("restaurant.openingHours.dayToday", { day: label }) : label}
                </ThemedText>
              </View>

              <View style={styles.hoursCell}>
                {isOpenDay ? (
                  <View style={styles.hoursColumn}>
                    <ThemedText
                      style={[
                        styles.hoursText,
                        isToday && { color: colors.text, fontWeight: "600" },
                        !isToday && { color: colors.muted },
                      ]}
                    >
                      {open} – {close}
                    </ThemedText>
                    {lastBooking && (
                      <ThemedText style={[styles.lastBookingText, { color: colors.muted }]}>
                        {t("restaurant.openingHours.lastBooking", { time: lastBooking })}
                      </ThemedText>
                    )}
                  </View>
                ) : (
                  <ThemedText style={[styles.closedText, { color: colors.muted }]}>
                    {t("restaurant.openingHours.closed")}
                  </ThemedText>
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
                      {t("restaurant.openingHours.walkIn")}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ThemedView>

      {upcomingDates.length > 0 && (
        <ThemedView
          style={[
            styles.table,
            styles.datesTable,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          testID="upcoming-dates"
        >
          <View style={[styles.row, styles.datesHeader, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.datesTitle, { color: colors.muted }]}>
              {t("restaurant.openingHours.upcomingDatesTitle")}
            </ThemedText>
          </View>
          {upcomingDates.map((entry, idx) => (
            <View
              key={entry.date}
              style={[
                styles.row,
                idx < upcomingDates.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
              testID={`upcoming-date-${entry.date}`}
            >
              <View style={styles.dayCell}>
                <ThemedText style={styles.dayText}>{fmtDateString(entry.date)}</ThemedText>
              </View>
              <View style={styles.hoursCell}>
                <View style={styles.hoursColumn}>
                  <ThemedText
                    style={[
                      entry.type === "specialHours" ? styles.hoursText : styles.closedText,
                      { color: colors.muted },
                    ]}
                  >
                    {dateDetail(entry)}
                  </ThemedText>
                  {entry.type === "specialHours" && entry.lastBooking && (
                    <ThemedText style={[styles.lastBookingText, { color: colors.muted }]}>
                      {t("restaurant.openingHours.lastBooking", { time: entry.lastBooking })}
                    </ThemedText>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ThemedView>
      )}
    </>
  );
}
