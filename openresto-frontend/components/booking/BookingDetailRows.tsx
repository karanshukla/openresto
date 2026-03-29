import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { BookingDto } from "@/api/bookings";
import { RestaurantDto } from "@/api/restaurants";

interface BookingDetailRowsProps {
  booking: BookingDto;
  restaurant: RestaurantDto | null;
  mutedColor: string;
  borderColor: string;
}

type RowData = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
};

function buildRows(booking: BookingDto, restaurant: RestaurantDto | null): RowData[] {
  const rows: RowData[] = [];

  if (restaurant) {
    rows.push({ icon: "restaurant-outline", label: "Restaurant", value: restaurant.name });
    if (restaurant.address) {
      rows.push({ icon: "location-outline", label: "Address", value: restaurant.address });
    }
  }

  rows.push({ icon: "mail-outline", label: "Email", value: booking.customerEmail });

  rows.push({
    icon: "calendar-outline",
    label: "Date",
    value: new Date(booking.date).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  });

  rows.push({
    icon: "time-outline",
    label: "Time",
    value: new Date(booking.date).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  rows.push({
    icon: "people-outline",
    label: "Guests",
    value: `${booking.seats}${booking.tableSeats ? ` (Table for ${booking.tableSeats})` : ""}`,
  });

  if (booking.tableName) {
    rows.push({
      icon: "grid-outline",
      label: "Table",
      value: booking.sectionName
        ? `${booking.tableName} (${booking.sectionName})`
        : booking.tableName,
    });
  }

  if (booking.specialRequests) {
    rows.push({ icon: "chatbubble-outline", label: "Requests", value: booking.specialRequests });
  }

  return rows;
}

export default function BookingDetailRows({
  booking,
  restaurant,
  mutedColor,
  borderColor,
}: BookingDetailRowsProps) {
  const rows = buildRows(booking, restaurant);

  return (
    <>
      {rows.map(({ icon, label, value }, i) => (
        <View key={label}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
          <View style={styles.row}>
            <Ionicons name={icon} size={15} color={mutedColor} />
            <View style={styles.content}>
              <ThemedText style={[styles.label, { color: mutedColor }]}>{label}</ThemedText>
              <ThemedText style={styles.value}>{value}</ThemedText>
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  content: { flex: 1, gap: 2 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  value: { fontSize: 15, fontWeight: "500" },
  divider: { height: 1 },
});
