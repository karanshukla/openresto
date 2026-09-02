import React, { useEffect, useState } from "react";
import { Platform, Share, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { BookingDto } from "@/api/bookings";
import { RestaurantDto } from "@/api/restaurants";
import { isPast } from "@/utils/bookingStatus";
import { fmtDateTime } from "@/utils/formatters";
import BookingSummaryHeader from "@/components/booking/BookingSummaryHeader";
import BookingFactsBand from "@/components/booking/BookingFactsBand";
import BookingGuestDetails from "@/components/booking/BookingGuestDetails";
import CalendarActions from "@/components/booking/CalendarActions";
import DirectionsActions from "@/components/booking/DirectionsActions";
import { mapFrameStyle, styles } from "./BookingResultPanel.styles";

interface BookingResultPanelProps {
  booking: BookingDto;
  restaurant: RestaurantDto | null;
  /** Compact (phone-width) layout vs. the wide two-column layout. */
  compact: boolean;
  /** Arrived via /booking-confirmation, fresh off creating the booking — the only thing
   * that changes is the status line ("Booking Confirmed" instead of "Booking Found"). A
   * cancelled or past booking overrides this the same way it overrides "Booking Found". */
  justBooked?: boolean;
  cancelling: boolean;
  onCancelPress: () => void;
}

/**
 * The found/cancelled/past booking, as one card in four zones: the answer (where, and its
 * state), the facts (date, time, party), the reference, then who it's under. Actions —
 * calendar, map, directions, cancel — follow below, each behind a hairline. Shared by every
 * door into the lookup screen: the plain form, a deep link, and /booking-confirmation,
 * which used to render this independently in two places. The status line is the only thing
 * that changes between them, so it's the one prop (`justBooked`) this takes on top of the
 * booking itself.
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
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);

  const ref = booking.bookingRef ?? "";
  const bookingIsPast = isPast(booking.date);
  const actionable = !booking.isCancelled && !bookingIsPast;

  // Cancelled and past override justBooked the same way they override "Booking Found" —
  // a booking that's already cancelled or over doesn't get a celebratory status.
  const statusLabel = booking.isCancelled
    ? t("booking.result.statusCancelled")
    : bookingIsPast
      ? t("booking.result.statusPassed")
      : justBooked
        ? t("booking.result.statusConfirmed")
        : t("booking.result.statusFound");
  const statusIcon = booking.isCancelled
    ? "close-circle"
    : bookingIsPast
      ? "time-outline"
      : "checkmark-circle";
  const statusColor = booking.isCancelled
    ? theme.colors.error
    : bookingIsPast
      ? colors.muted
      : primaryColor;

  // A status demoted to an eyebrow would under-weight the two outcomes that change what
  // the diner does next, so those two wash the whole header instead.
  const headerTint = booking.isCancelled
    ? `${theme.colors.error}${isDark ? "1F" : "12"}`
    : bookingIsPast
      ? colors.surfaceAlt
      : null;

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

  /**
   * The share sheet is where a phone puts "send this to someone", and it covers the clipboard
   * too, so the one control does what the web strip's Copy does and more. Web keeps Copy: a
   * browser has no sheet worth the name.
   *
   * @see [BookingResultPanel.test.tsx](../../tests/components/booking/BookingResultPanel.test.tsx)
   * — pins that Share replaces Copy off web and what it puts on the sheet.
   */
  const handleShare = () => {
    Share.share({
      message: t("booking.result.shareMessage", {
        ref,
        name: restaurant?.name ?? t("booking.result.unnamedRestaurant"),
        when: fmtDateTime(new Date(booking.date)),
        count: booking.seats,
      }),
    }).catch(() => {});
  };

  const handleCopy = () => {
    if (Platform.OS === "web" && navigator.clipboard && ref) {
      navigator.clipboard.writeText(ref);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const divider = <View style={[styles.divider, { backgroundColor: colors.border }]} />;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <BookingSummaryHeader
        booking={booking}
        restaurant={restaurant}
        statusLabel={statusLabel}
        statusIcon={statusIcon}
        statusColor={statusColor}
        mutedColor={colors.muted}
        tint={headerTint}
      />

      {divider}

      <BookingFactsBand
        booking={booking}
        compact={compact}
        mutedColor={colors.muted}
        borderColor={colors.border}
        negated={booking.isCancelled}
      />

      {/* Stated once. The reference used to appear as a badge in the header and again as a
          detail row, which read as two different things to quote back to the restaurant. */}
      {ref ? (
        <>
          {divider}
          <View style={[styles.refStrip, { backgroundColor: colors.surfaceAlt }]}>
            <View style={styles.refTextGroup}>
              <ThemedText style={[styles.refLabel, { color: colors.muted }]}>
                {t("booking.result.referenceLabel")}
              </ThemedText>
              <ThemedText style={[styles.refValue, { color: primaryColor }]}>{ref}</ThemedText>
            </View>
            {Platform.OS === "web" ? (
              <Button
                variant="ghost"
                size="sm"
                tone="neutral"
                icon={copied ? "checkmark" : "copy-outline"}
                onPress={handleCopy}
                accessibilityLabel={
                  copied
                    ? t("booking.result.referenceCopiedLabel")
                    : t("booking.result.copyReferenceLabel")
                }
              >
                {copied ? t("booking.result.copiedButton") : t("booking.result.copyButton")}
              </Button>
            ) : (
              <Button
                testID="share-booking-btn"
                variant="ghost"
                size="sm"
                tone="neutral"
                icon="share-outline"
                onPress={handleShare}
                accessibilityLabel={t("booking.result.shareLabel")}
              >
                {t("booking.result.shareButton")}
              </Button>
            )}
          </View>
        </>
      ) : null}

      {divider}

      <BookingGuestDetails booking={booking} mutedColor={colors.muted} />

      {ref && (
        <>
          {divider}
          <CalendarActions
            bookingRef={ref}
            date={booking.date}
            endTime={booking.endTime}
            seats={booking.seats}
            specialRequests={booking.specialRequests}
            restaurantName={restaurant?.name ?? t("booking.result.unnamedRestaurant")}
            restaurantAddress={restaurant?.address ?? ""}
            sectionName={booking.sectionName}
            tableName={booking.tableName}
          />
        </>
      )}

      {restaurant?.address && (
        <>
          {divider}
          {/* The address is already the header's subline, so the map carries only the
              marker — no caption repeating what's at the top of the card. */}
          {Platform.OS === "web" && mapCoords && (
            <View style={styles.mapSection}>
              {React.createElement("iframe", {
                title: t("booking.result.mapTitle", { name: restaurant.name }),
                src: `https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.005},${mapCoords.lat - 0.005},${mapCoords.lng + 0.005},${mapCoords.lat + 0.005}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lng}`,
                style: mapFrameStyle,
                loading: "lazy",
              })}
            </View>
          )}
          <DirectionsActions address={restaurant.address} />
        </>
      )}

      {divider}

      <View style={styles.cancelSection}>
        {actionable ? (
          <>
            {/* Filled: cancelling a booking is the one thing on this card that can't be
                walked back, and it's the only control here at that weight — the calendar
                and directions pills above it are side errands at the row scale. */}
            <Button
              variant="primary"
              tone="danger"
              size="md"
              icon="trash-outline"
              loading={cancelling}
              onPress={onCancelPress}
              accessibilityLabel={t("booking.result.cancelActionLabel")}
            >
              {t("booking.result.cancelButton")}
            </Button>
            <ThemedText style={[styles.cancelHint, { color: colors.muted }]}>
              {t("booking.result.cancelHint")}
            </ThemedText>
          </>
        ) : (
          <ThemedText style={[styles.cancelHint, { color: colors.muted }]}>
            {booking.isCancelled ? t("booking.result.cancelledHint") : t("booking.result.pastHint")}
          </ThemedText>
        )}
      </View>
    </View>
  );
}
