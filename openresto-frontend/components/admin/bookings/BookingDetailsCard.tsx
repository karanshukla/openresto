import { View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { fmtLongDate, fmtMonthDay, fmtTime } from "@/utils/formatters";
import { bookingDetailStyles as styles } from "./booking-detail.styles";

interface BookingDetailsCardProps {
  booking: {
    id: number;
    bookingRef?: string;
    customerEmail: string;
    customerName?: string;
    date: string;
    endTime?: string;
    seats: number;
    restaurantName: string;
    sectionName: string | null;
    tableName: string | null;
    specialRequests?: string;
    isCancelled?: boolean;
  };
  borderColor: string;
  mutedColor: string;
  cardColor: string;
  style?: ViewStyle;
}

export function BookingDetailsCard({
  booking,
  borderColor,
  mutedColor,
  cardColor,
  style,
}: BookingDetailsCardProps) {
  const { t } = useTranslation();
  const startTime = new Date(booking.date);
  const endTime = booking.endTime
    ? new Date(booking.endTime)
    : new Date(startTime.getTime() + 60 * 60 * 1000);

  const diffMs = endTime.getTime() - startTime.getTime();
  const durationMins = Math.round(diffMs / 60000);

  const formatTime = fmtTime;
  const formatDate = fmtMonthDay;

  const timeRangeDisplay =
    startTime.toDateString() === endTime.toDateString()
      ? `${formatTime(startTime)} – ${formatTime(endTime)}`
      : `${formatTime(startTime)} (${formatDate(startTime)}) – ${formatTime(endTime)} (${formatDate(endTime)})`;

  // Field order mirrors EditBookingForm/NewBookingModal (restaurant → section → table →
  // date → time → guests → email → name → requests) so the read-only card and the edit
  // form stay visually aligned when both are shown side by side.
  /**
   * `key` (rather than the localized `label`) drives the "Status" highlight style below,
   * since a translated label can't be compared against an English literal.
   * @see [BookingDetailsCard.test.tsx](../../../tests/components/BookingDetailsCard.test.tsx)
   * — pins that the cancelled-row highlight still applies once the label is translated.
   */
  const rows: { key: string; label: string; value: string }[] = [
    {
      key: "ref",
      label: t("admin.bookings.detail.fields.ref"),
      value: booking.bookingRef ?? `#${booking.id}`,
    },
    {
      key: "restaurant",
      label: t("admin.bookings.form.restaurant"),
      value: booking.restaurantName,
    },
    ...(booking.sectionName
      ? [{ key: "section", label: t("booking.form.sectionLabel"), value: booking.sectionName }]
      : []),
    {
      key: "table",
      label: t("booking.form.tableLabel"),
      value: booking.tableName ?? t("booking.form.tableLabel"),
    },
    {
      key: "date",
      label: t("booking.form.dateLabel"),
      value: fmtLongDate(startTime),
    },
    {
      key: "time",
      label: t("booking.form.timeLabel"),
      value: t("admin.bookings.detail.timeRangeWithDuration", {
        range: timeRangeDisplay,
        mins: durationMins,
      }),
    },
    {
      key: "party",
      label: t("admin.bookings.detail.fields.party"),
      value: t("booking.form.partySize", { count: booking.seats }),
    },
    { key: "email", label: t("booking.form.emailLabel"), value: booking.customerEmail },
    ...(booking.customerName
      ? [
          {
            key: "name",
            label: t("admin.bookings.detail.fields.name"),
            value: booking.customerName,
          },
        ]
      : []),
    {
      key: "requests",
      label: t("admin.bookings.detail.fields.requests"),
      value: booking.specialRequests || t("admin.bookings.detail.noRequests"),
    },
  ];

  if (booking.isCancelled) {
    rows.push({
      key: "status",
      label: t("admin.bookings.sort.status"),
      value: t("admin.bookings.status.cancelled").toUpperCase(),
    });
  }

  return (
    <View style={[styles.card, { backgroundColor: cardColor, borderColor }, style]}>
      {rows.map(({ key, label, value }, i) => (
        <View key={key}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
          <View style={styles.row}>
            <ThemedText style={[styles.rowLabel, { color: mutedColor }]}>{label}</ThemedText>
            <ThemedText
              style={[
                styles.rowValue,
                key === "status" && { color: theme.colors.error, fontWeight: "700" },
              ]}
            >
              {value}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}
