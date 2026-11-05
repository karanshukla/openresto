import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import BookingForm, { BookingFormData } from "@/components/booking/BookingForm";
import { submitBooking } from "@/components/booking/submitBooking";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import Select from "@/components/common/Select";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { reportEmbedHeight } from "@/utils/embedHeight";
import { fmtDateString } from "@/utils/formatters";
import { styles } from "./EmbedBooking.styles";

interface Confirmed {
  ref: string;
  email: string;
  restaurantName: string;
  seats: number;
  date: string;
  time: string;
}

/**
 * The booking widget a restaurant puts on its own site (issue #513): the booking form with no
 * site chrome, pinned to one location or with a picker over all of them. The confirmation stays
 * in the frame and shows the reference, because the recent-bookings cookie is SameSite=Strict
 * and a browser does not store it from inside another site's page.
 *
 * @see [EmbedBooking.test.tsx](../../tests/components/embed/EmbedBooking.test.tsx): pins the
 * pinned/picker split, that the reference is shown after booking, and the height report.
 */
export default function EmbedBooking({ locationId }: { locationId?: number }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [restaurants, setRestaurants] = useState<RestaurantDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | undefined>(locationId);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  useEffect(() => {
    fetchRestaurants().then((all) => {
      const pinned = all.filter((r) => r.id === locationId);
      setRestaurants(pinned.length > 0 ? pinned : all);
    });
  }, [locationId]);

  const restaurant = restaurants?.find((r) => r.id === selectedId) ?? restaurants?.[0];

  const handleSubmit = async (restaurant: RestaurantDto, data: BookingFormData) => {
    setSubmitError(null);
    try {
      const booking = await submitBooking(restaurant, data);
      if (booking?.bookingRef) {
        setConfirmed({
          ref: booking.bookingRef,
          email: data.customerEmail,
          restaurantName: restaurant.name,
          seats: data.seats,
          date: data.date,
          time: data.time,
        });
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("booking.drawer.genericSubmitError"));
    }
  };

  const body = () => {
    if (!restaurants) return <ActivityIndicator color={colors.muted} />;
    if (!restaurant) {
      return (
        <ThemedText style={[styles.error, { color: colors.muted }]}>
          {t("booking.embed.unavailable")}
        </ThemedText>
      );
    }
    if (confirmed) {
      return (
        <View
          testID="embed-confirmation"
          style={[styles.confirmed, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <ThemedText style={styles.title}>{t("booking.result.routeTitleConfirmed")}</ThemedText>
          <ThemedText style={{ color: colors.muted }}>
            {confirmed.restaurantName} ·{" "}
            {t("booking.drawer.summaryLine", {
              count: confirmed.seats,
              when: fmtDateString(confirmed.date),
              time: confirmed.time,
            })}
          </ThemedText>
          <View>
            <ThemedText style={{ color: colors.muted }}>
              {t("booking.result.referenceLabel")}
            </ThemedText>
            <ThemedText style={styles.reference} selectable testID="embed-booking-ref">
              {confirmed.ref}
            </ThemedText>
          </View>
          <ButtonRow align="start">
            <Button
              variant="secondary"
              tone="neutral"
              icon="open-outline"
              testID="embed-view-booking"
              onPress={() =>
                Linking.openURL(
                  `/booking-confirmation/${confirmed.ref}?email=${encodeURIComponent(confirmed.email)}`
                )
              }
            >
              {t("booking.embed.viewBooking")}
            </Button>
            <Button variant="ghost" tone="brand" onPress={() => setConfirmed(null)}>
              {t("booking.embed.bookAnother")}
            </Button>
          </ButtonRow>
        </View>
      );
    }
    return (
      <>
        {restaurants.length > 1 ? (
          <Select
            accessibilityLabel={t("booking.drawer.locationSelectLabel")}
            selectedValue={restaurant.id}
            options={restaurants.map((r) => ({ label: r.name, value: r.id }))}
            onSelect={(value) => setSelectedId(Number(value))}
          />
        ) : (
          <ThemedText style={styles.title}>{restaurant.name}</ThemedText>
        )}
        {submitError && (
          <ThemedText role="alert" style={[styles.error, { color: colors.error }]}>
            {submitError}
          </ThemedText>
        )}
        <BookingForm
          key={restaurant.id}
          layout="drawer"
          restaurant={restaurant}
          onSubmit={(data) => handleSubmit(restaurant, data)}
        />
      </>
    );
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: colors.page }]}>
      <View
        testID="embed-booking"
        style={styles.content}
        onLayout={(e) => reportEmbedHeight(e.nativeEvent.layout.height)}
      >
        {body()}
      </View>
    </ScrollView>
  );
}
