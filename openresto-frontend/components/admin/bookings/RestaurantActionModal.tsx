import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  adminGetRestaurants,
  pauseRestaurantBookings,
  unpauseRestaurantBookings,
  extendRestaurantBookings,
  BookingDetailDto,
} from "@/api/admin";

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
    { id: number; name: string; bookingsPausedUntil?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [extendedBookings, setExtendedBookings] = useState<BookingDetailDto[] | null>(null);

  useEffect(() => {
    if (visible) {
      loadRestaurants();
      setExtendedBookings(null);
    }
  }, [visible]);

  async function loadRestaurants() {
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[styles.content, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {extendedBookings
                ? "Bookings Extended"
                : actionType === "pause"
                  ? "Pause Bookings"
                  : "Extend Bookings"}
            </ThemedText>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.muted} />
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
            <ActivityIndicator style={styles.spinner} color={primaryColor} />
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
              <View style={styles.footer}>
                <Pressable
                  onPress={onClose}
                  style={[styles.doneBtn, { backgroundColor: primaryColor }]}
                >
                  <ThemedText style={styles.doneBtnText}>Done</ThemedText>
                </Pressable>
              </View>
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
                const willPauseUntil = new Date(Date.now() + 60 * 60 * 1000).toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" }
                );

                return (
                  <Pressable
                    key={r.id}
                    onPress={() => handleAction(r.id, r.name, isPaused)}
                    disabled={submitting !== null}
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
                              style={{ color: "#ef4444", fontSize: 10, fontWeight: "700" }}
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
                            : `ID: ${r.id}`}
                      </ThemedText>
                    </View>
                    {submitting === r.id ? (
                      <ActivityIndicator size="small" color={primaryColor} />
                    ) : (
                      <Ionicons
                        name={
                          actionType === "extend"
                            ? "time-outline"
                            : isPaused
                              ? "play-circle-outline"
                              : "pause-circle-outline"
                        }
                        size={20}
                        color={isPaused && actionType === "pause" ? "#16a34a" : primaryColor}
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    width: "100%",
    maxWidth: 500,
    maxHeight: "80%",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
      },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    paddingHorizontal: 20,
    marginBottom: 20,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemMain: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
  },
  itemMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  spinner: {
    padding: 40,
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  doneBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
