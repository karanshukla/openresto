import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { BookingDto } from "@/api/bookings";
import { RestaurantDto } from "@/api/restaurants";
import { isPast } from "@/utils/bookingStatus";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import CalendarActions from "@/components/booking/CalendarActions";
import DirectionsActions from "@/components/booking/DirectionsActions";
import { styles } from "./BookingResultPanel.styles";

interface BookingResultPanelProps {
  booking: BookingDto;
  restaurant: RestaurantDto | null;
  /** Compact (phone-width) layout vs. the wide two-column layout. */
  compact: boolean;
  /** Arrived via /booking-confirmation, fresh off creating the booking — the only thing
   * that changes is the header line ("Booking Confirmed" instead of "Booking Found"). A
   * cancelled or past booking overrides this the same way it overrides "Booking Found". */
  justBooked?: boolean;
  cancelling: boolean;
  onCancelPress: () => void;
}

/**
 * The found/cancelled/past booking card: header, reference + copy, detail rows, calendar
 * actions, a directions card with an embedded map, and the cancel action. Shared by every
 * door into the lookup screen — the plain form, a deep link, and /booking-confirmation —
 * which used to render this independently in two places. The header line is the only
 * thing that changes between them, so it's the one prop (`justBooked`) this component
 * takes on top of the booking itself.
 */
export default function BookingResultPanel({
  booking,
  restaurant,
  compact,
  justBooked = false,
  cancelling,
  onCancelPress,
}: BookingResultPanelProps) {
  const { colors, primaryColor, isDark } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);

  const ref = booking.bookingRef ?? "";
  const bookingIsPast = isPast(booking.date);
  const actionable = !booking.isCancelled && !bookingIsPast;

  // Cancelled and past override justBooked the same way they override "Booking Found" —
  // a booking that's already cancelled or over doesn't get a celebratory header.
  const headerTitle = booking.isCancelled
    ? "Booking Cancelled"
    : bookingIsPast
      ? "Booking Has Passed"
      : justBooked
        ? "Booking Confirmed"
        : "Booking Found";
  const headerIcon = booking.isCancelled
    ? "close-circle"
    : bookingIsPast
      ? "time-outline"
      : "checkmark-circle";
  const headerColor = booking.isCancelled
    ? theme.colors.error
    : bookingIsPast
      ? colors.muted
      : primaryColor;

  useEffect(() => {
    if (!restaurant?.address) {
      setMapCoords(null);
      return;
    }
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(restaurant.address)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data[0]) {
          setMapCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [restaurant?.address]);

  const handleCopy = () => {
    if (Platform.OS === "web" && navigator.clipboard && ref) {
      navigator.clipboard.writeText(ref);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.stack}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.headerRow}>
            <Icon name={headerIcon} size="xl" color={headerColor} />
            <ThemedText style={styles.title}>{headerTitle}</ThemedText>
          </View>
          <View style={styles.refRow}>
            <View
              style={[
                styles.refBadge,
                { backgroundColor: isDark ? `${primaryColor}22` : `${primaryColor}14` },
              ]}
            >
              <ThemedText style={[styles.refText, { color: primaryColor }]}>{ref}</ThemedText>
            </View>
            {Platform.OS === "web" && ref && (
              <Button
                variant="ghost"
                size="sm"
                tone="neutral"
                icon={copied ? "checkmark" : "copy-outline"}
                onPress={handleCopy}
                accessibilityLabel={copied ? "Booking reference copied" : "Copy booking reference"}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            )}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <BookingDetailRows
          booking={booking}
          restaurant={restaurant}
          mutedColor={colors.muted}
          borderColor={colors.border}
        />
      </View>

      {/* Calendar links rely on window.open, so — like the rest of this app's calendar
          actions — they stay web-only; directions below use Linking.openURL, which works
          on native, so they render on every platform. */}
      {Platform.OS === "web" && ref && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <CalendarActions
            bookingRef={ref}
            date={booking.date}
            endTime={booking.endTime}
            seats={booking.seats}
            specialRequests={booking.specialRequests}
            restaurantName={restaurant?.name ?? "Restaurant"}
            restaurantAddress={restaurant?.address ?? ""}
            sectionName={booking.sectionName}
            tableName={booking.tableName}
            variant={compact ? "compact" : "full"}
          />
        </View>
      )}

      {restaurant?.address && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.mapCard}>
            {Platform.OS === "web" &&
              mapCoords &&
              React.createElement("iframe", {
                src: `https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.005},${mapCoords.lat - 0.005},${mapCoords.lng + 0.005},${mapCoords.lat + 0.005}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lng}`,
                style: styles.mapFrame,
                loading: "lazy",
              })}
            <View style={styles.mapAddressRow}>
              <Icon name="location-outline" size={13} color={colors.muted} />
              <ThemedText style={[styles.mapAddress, { color: colors.muted }]} numberOfLines={2}>
                {restaurant.address}
              </ThemedText>
            </View>
          </View>
          <DirectionsActions address={restaurant.address} compact={compact} />
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cancelCard}>
          {actionable ? (
            <>
              <Button
                variant="secondary"
                tone="danger"
                size="md"
                icon="trash-outline"
                loading={cancelling}
                onPress={onCancelPress}
                accessibilityLabel="Cancel this booking"
              >
                Cancel This Booking
              </Button>
              <ThemedText style={[styles.cancelHint, { color: colors.muted }]}>
                This booking cannot be modified. However, feel free to cancel and rebook if need be.
              </ThemedText>
            </>
          ) : (
            <ThemedText style={[styles.cancelHint, { color: colors.muted }]}>
              {booking.isCancelled
                ? "This booking has been cancelled."
                : "This booking has already passed and can no longer be cancelled."}
            </ThemedText>
          )}
        </View>
      </View>
    </View>
  );
}
