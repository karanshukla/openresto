import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { BookingDto } from "@/api/bookings";
import { RestaurantDto } from "@/api/restaurants";
import { styles } from "./BookingSummaryHeader.styles";

interface BookingSummaryHeaderProps {
  booking: BookingDto;
  restaurant: RestaurantDto | null;
  statusLabel: string;
  statusIcon: IconName;
  statusColor: string;
  mutedColor: string;
  /** Wash behind the whole header, used to carry a cancelled/past state at card scale. */
  tint?: string | null;
}

/**
 * Where and what, in two lines: the restaurant heads the card and its address and seating
 * collapse into one subline, so four separate label/value rows become the thing you read
 * first. Section and table join the address rather than standing alone — on their own
 * they're two words of context, next to the address they're the rest of the directions.
 */
export function buildSeatingLine(booking: BookingDto, restaurant: RestaurantDto | null): string {
  const seating = booking.tableGroupId
    ? (booking.tableName ?? "Combined tables")
    : booking.tableName;

  return [restaurant?.address, booking.sectionName, seating].filter(Boolean).join(" · ");
}

export default function BookingSummaryHeader({
  booking,
  restaurant,
  statusLabel,
  statusIcon,
  statusColor,
  mutedColor,
  tint = null,
}: BookingSummaryHeaderProps) {
  const seatingLine = buildSeatingLine(booking, restaurant);
  const name = restaurant?.name;

  return (
    <View
      testID="booking-summary-header"
      style={[styles.header, tint ? { backgroundColor: tint } : null]}
    >
      {/* A lookup that couldn't resolve the restaurant has no name to head the card with,
          so the outcome takes the headline rather than leaving an eyebrow floating over an
          empty space. */}
      {name ? (
        <View style={styles.statusRow}>
          <Icon name={statusIcon} size={15} color={statusColor} />
          <ThemedText style={[styles.status, { color: statusColor }]}>{statusLabel}</ThemedText>
        </View>
      ) : null}

      <ThemedText style={styles.name}>{name ?? statusLabel}</ThemedText>

      {seatingLine ? (
        <ThemedText style={[styles.seating, { color: mutedColor }]}>{seatingLine}</ThemedText>
      ) : null}
    </View>
  );
}
