import { View, ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { COLORS } from "@/theme/theme";
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
  const startTime = new Date(booking.date);
  const endTime = booking.endTime
    ? new Date(booking.endTime)
    : new Date(startTime.getTime() + 60 * 60 * 1000);

  const diffMs = endTime.getTime() - startTime.getTime();
  const durationMins = Math.round(diffMs / 60000);

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const timeRangeDisplay =
    startTime.toDateString() === endTime.toDateString()
      ? `${formatTime(startTime)} – ${formatTime(endTime)}`
      : `${formatTime(startTime)} (${formatDate(startTime)}) – ${formatTime(endTime)} (${formatDate(endTime)})`;

  const rows: { label: string; value: string }[] = [
    { label: "Ref", value: booking.bookingRef ?? `#${booking.id}` },
    ...(booking.customerName ? [{ label: "Name", value: booking.customerName }] : []),
    { label: "Email", value: booking.customerEmail },
    {
      label: "Date",
      value: startTime.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    {
      label: "Time",
      value: `${timeRangeDisplay} (${durationMins} min)`,
    },
    { label: "Party", value: `${booking.seats} guest${booking.seats !== 1 ? "s" : ""}` },
    { label: "Restaurant", value: booking.restaurantName },
    ...(booking.sectionName ? [{ label: "Section", value: booking.sectionName }] : []),
    { label: "Table", value: booking.tableName ?? "Table" },
    { label: "Requests", value: booking.specialRequests || "None" },
  ];

  if (booking.isCancelled) {
    rows.push({ label: "Status", value: "CANCELLED" });
  }

  return (
    <View style={[styles.card, { backgroundColor: cardColor, borderColor }, style]}>
      {rows.map(({ label, value }, i) => (
        <View key={label}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
          <View style={styles.row}>
            <ThemedText style={[styles.rowLabel, { color: mutedColor }]}>{label}</ThemedText>
            <ThemedText
              style={[
                styles.rowValue,
                label === "Status" &&
                  value === "CANCELLED" && { color: COLORS.error, fontWeight: "700" },
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
