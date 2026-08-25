import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { BookingDto } from "@/api/bookings";
import { RestaurantDto } from "@/api/restaurants";
import i18n from "@/i18n";
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
/**
 * `t` defaults to the global i18next instance's own translator so this stays callable outside
 * a React tree (existing tests call it directly).
 */
export function buildSeatingLine(
  booking: BookingDto,
  restaurant: RestaurantDto | null,
  t: TFunction = i18n.t.bind(i18n)
): string {
  const seating = booking.tableGroupId
    ? (booking.tableName ?? t("booking.summaryHeader.combinedTablesFallback"))
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
  const { t } = useTranslation();
  const seatingLine = buildSeatingLine(booking, restaurant, t);
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
