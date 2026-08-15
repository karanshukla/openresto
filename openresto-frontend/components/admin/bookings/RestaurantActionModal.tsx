import { useEffect, useState } from "react";
import { Modal, Pressable, View, ScrollView, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  adminGetRestaurants,
  pauseRestaurantBookings,
  unpauseRestaurantBookings,
  extendRestaurantBookings,
  BookingDetailDto,
} from "@/api/admin";
import { styles } from "./RestaurantActionModal.styles";
import { theme } from "@/theme/theme";
import { Icon } from "@/components/common/Icon";

interface RestaurantActionModalProps {
  visible: boolean;
  onClose: () => void;
  actionType: "pause" | "extend";
  onSuccess?: (message: string) => void;
}

export default function RestaurantActionModal({
  visible,
  onClose,
  actionType,
  onSuccess,
}: RestaurantActionModalProps) {
  const { colors, primaryColor } = useAppTheme();
  const [restaurants, setRestaurants] = useState<
    { id: number; name: string; bookingsPausedUntil?: string; activeBookingsCount?: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [extendedBookings, setExtendedBookings] = useState<BookingDetailDto[] | null>(null);
  const [willPauseUntil, setWillPauseUntil] = useState("");

  async function loadRestaurants() {
    setExtendedBookings(null);
    setWillPauseUntil(
      new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
    setLoading(true);
    try {
      const data = await adminGetRestaurants();
      setRestaurants(data);
    } catch (err) {
      console.error("Failed to load restaurants", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRestaurants();
    }
  }, [visible]);

  async function handleAction(
    restaurantId: number,
    restaurantName: string,
    isCurrentlyPaused: boolean
  ) {
    if (submitting !== null) return;
    setSubmitting(restaurantId);

    try {
      if (actionType === "extend") {
        const result = await extendRestaurantBookings(restaurantId, 60);
        if (result.ok) {
          if (result.extendedBookings.length > 0) {
            setExtendedBookings(result.extendedBookings);
          } else {
            onSuccess?.(`No active bookings found to extend for ${restaurantName}.`);
            onClose();
          }
        }
      } else {
        if (isCurrentlyPaused) {
          await unpauseRestaurantBookings(restaurantId);
          onSuccess?.(`Bookings for ${restaurantName} have been resumed.`);
        } else {
          await pauseRestaurantBookings(restaurantId, 60);
          onSuccess?.(`Bookings for ${restaurantName} have been paused for 1 hour.`);
        }
        onClose();
      }
    } catch (err) {
      console.error(`Failed to ${actionType} bookings for restaurant`, err);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={
            extendedBookings
              ? "Bookings extended"
              : actionType === "pause"
                ? "Pause bookings"
                : "Extend bookings"
          }
          style={[styles.content, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.header}>
            <ThemedText style={styles.title} accessibilityRole="header">
              {extendedBookings
                ? "Bookings Extended"
                : actionType === "pause"
                  ? "Pause Bookings"
                  : "Extend Bookings"}
            </ThemedText>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              testID="close-modal-button"
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size="xxl" color={colors.muted} />
            </Pressable>
          </View>

          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
            {extendedBookings
              ? `The following ${extendedBookings.length} bookings have been extended by 1 hour:`
              : actionType === "pause"
                ? "Select a restaurant to pause or resume its bookings."
                : "Select a restaurant to extend all active bookings by 1 hour."}
          </ThemedText>

          {loading ? (
            <ActivityIndicator
              style={styles.spinner}
              color={primaryColor}
              testID="loading-indicator"
              accessibilityLabel="Loading restaurants"
            />
          ) : extendedBookings ? (
            <>
              <ScrollView style={styles.list}>
                {extendedBookings.map((b) => (
                  <View key={b.id} style={[styles.item, { borderBottomColor: colors.border }]}>
                    <View style={styles.itemMain}>
                      <ThemedText style={styles.itemName}>{b.customerEmail}</ThemedText>
                      <ThemedText style={[styles.itemMeta, { color: colors.muted }]}>
                        {new Date(b.date).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" → "}
                        {b.endTime
                          ? new Date(b.endTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Extended"}
                        {` · ${b.seats} guests`}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <ButtonRow style={styles.footer}>
                <Button size="md" onPress={onClose}>
                  Done
                </Button>
              </ButtonRow>
            </>
          ) : restaurants.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText style={{ color: colors.muted }}>No restaurants found.</ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {restaurants.map((r) => {
                const isPaused = r.bookingsPausedUntil
                  ? new Date(r.bookingsPausedUntil) > new Date()
                  : false;

                return (
                  <Pressable
                    key={r.id}
                    onPress={() => handleAction(r.id, r.name, isPaused)}
                    disabled={submitting !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`${isPaused ? "Resume" : "Pause"} bookings for ${r.name}`}
                    accessibilityState={{ disabled: submitting !== null }}
                    style={({ pressed }) => [
                      styles.item,
                      { borderBottomColor: colors.border },
                      pressed && { backgroundColor: `${colors.muted}10` },
                    ]}
                  >
                    <View style={styles.itemMain}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <ThemedText style={styles.itemName}>{r.name}</ThemedText>
                        {isPaused && (
                          <View
                            style={{
                              backgroundColor: "#fee2e2",
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <ThemedText
                              style={{ color: theme.colors.error, fontSize: 10, fontWeight: "700" }}
                            >
                              PAUSED
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={[styles.itemMeta, { color: colors.muted }]}>
                        {isPaused
                          ? `Paused until ${new Date(r.bookingsPausedUntil!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : actionType === "pause"
                            ? `Will pause for 1 hour (until ${willPauseUntil})`
                            : `${r.activeBookingsCount ?? 0} active bookings`}
                      </ThemedText>
                    </View>
                    {submitting === r.id ? (
                      <ActivityIndicator size="small" color={primaryColor} />
                    ) : (
                      <Icon
                        name={
                          actionType === "extend"
                            ? "time-outline"
                            : isPaused
                              ? "play-circle-outline"
                              : "pause-circle-outline"
                        }
                        size="xl"
                        color={
                          isPaused && actionType === "pause" ? theme.colors.success : primaryColor
                        }
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
