import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View, Platform, Pressable, TextInput } from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BORDER_RADIUS, getThemeColors } from "@/theme/theme";
import { fetchRestaurants, createRestaurant, RestaurantDto } from "@/api/restaurants";
import {
  adminDeleteRestaurant,
  adminGetRestaurants,
  adminSetRestaurantArchived,
  pauseRestaurantBookings,
  unpauseRestaurantBookings,
  extendRestaurantBookings,
  BookingDetailDto,
} from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";

import { LocationCard } from "@/components/admin/settings/LocationCard";
import { styles } from "@/components/admin/settings/settings.styles";

function useConfirmLocal() {
  const [state, setState] = useState<{ message: string } | null>(null);
  const resolveRef = { current: null as ((v: boolean) => void) | null };

  const confirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message });
    });
  };

  const handleConfirm = () => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  };

  return { state, confirm, handleConfirm, handleCancel };
}

export default function AdminLocationsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [dangerZoneExpanded, setDangerZoneExpanded] = usePersistedState(
    "locations:danger:expanded",
    false
  );
  const [dangerSelectedId, setDangerSelectedId] = useState<number | null>(null);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(false);
  const [allRestaurants, setAllRestaurants] = useState<
    {
      id: number;
      name: string;
      isArchived?: boolean;
      bookingsPausedUntil?: string;
      activeBookingsCount?: number;
    }[]
  >([]);
  const [pausing, setPausing] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extendedBookings, setExtendedBookings] = useState<BookingDetailDto[] | null>(null);
  const [extendNoActive, setExtendNoActive] = useState(false);
  const isDark = useColorScheme() === "dark";
  const {
    state: confirmState,
    confirm: confirmAction,
    handleConfirm,
    handleCancel,
  } = useConfirmLocal();

  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;

  function patchRestaurant(id: number, patch: Partial<RestaurantDto>) {
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRestaurants(), adminGetRestaurants()]).then(([active, all]) => {
      if (cancelled) return;
      setRestaurants(active);
      if (active.length > 0) setSelectedId(active[0].id);
      setAllRestaurants(all);
      setLoading(false);
    });
    /* istanbul ignore next */
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRestaurant = restaurants.find((r) => r.id === selectedId) ?? null;
  const dangerSelectedRestaurant = allRestaurants.find((r) => r.id === dangerSelectedId) ?? null;
  const selectedAdminData = allRestaurants.find((r) => r.id === selectedId) ?? null;
  const isPaused = selectedAdminData?.bookingsPausedUntil
    ? new Date(selectedAdminData.bookingsPausedUntil) > new Date()
    : false;
  const pausedUntilText =
    isPaused && selectedAdminData?.bookingsPausedUntil
      ? new Date(selectedAdminData.bookingsPausedUntil).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  function handleSelectLocation(id: number) {
    setSelectedId(id);
    setExtendedBookings(null);
    setExtendNoActive(false);
  }

  function handleDangerSelect(id: number) {
    setDangerSelectedId(id);
    setDeleteStep("idle");
    setDeleteError(false);
    setArchiveError(false);
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={primaryColor} />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Locations" }} />}

      {/* ── Page header ─────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View style={{ gap: 2 }}>
          <ThemedText type="h1">Locations</ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {restaurants.length === 0
              ? "No locations configured"
              : `${restaurants.length} location${restaurants.length !== 1 ? "s" : ""} · all active`}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => setAddingLocation(true)}
          disabled={addingLocation}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: BORDER_RADIUS.md,
            backgroundColor: primaryColor,
            minHeight: 44,
            opacity: addingLocation ? 0.5 : 1,
          }}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <ThemedText style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
            Add location
          </ThemedText>
        </Pressable>
      </View>

      {/* ── Add location form ────────────────────────────────────────── */}
      {addingLocation && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderWidth: 1,
            borderColor: isDark ? `${primaryColor}40` : `${primaryColor}30`,
            borderRadius: BORDER_RADIUS.card,
            backgroundColor: isDark ? `${primaryColor}08` : `${primaryColor}04`,
          }}
        >
          <Ionicons name="storefront-outline" size={18} color={primaryColor} />
          <TextInput
            value={newLocationName}
            onChangeText={setNewLocationName}
            placeholder="Location name (e.g. Downtown, Westside)"
            placeholderTextColor={mutedColor}
            autoFocus
            style={{
              flex: 1,
              fontSize: 14,
              color: isDark ? "#fff" : "#111",
            }}
          />
          <Pressable
            disabled={savingLocation || !newLocationName.trim()}
            onPress={async () => {
              if (!newLocationName.trim()) return;
              setSavingLocation(true);
              const created = await createRestaurant(newLocationName.trim());
              setSavingLocation(false);
              if (created) {
                setRestaurants((prev) => [...prev, { ...created, sections: [] }]);
                setSelectedId(created.id);
              }
              setNewLocationName("");
              setAddingLocation(false);
            }}
            style={{
              backgroundColor: primaryColor,
              borderRadius: BORDER_RADIUS.md,
              paddingHorizontal: 14,
              paddingVertical: 8,
              opacity: savingLocation || !newLocationName.trim() ? 0.45 : 1,
            }}
          >
            <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
              {savingLocation ? "Adding…" : "Add"}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={
              /* istanbul ignore next */ () => {
                setAddingLocation(false);
                setNewLocationName("");
              }
            }
            style={{ padding: 6 }}
          >
            <Ionicons name="close-outline" size={20} color={mutedColor} />
          </Pressable>
        </View>
      )}

      {/* ── Location selector pills ──────────────────────────────────── */}
      {restaurants.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: "row", gap: 6, alignItems: "center" }}
        >
          {restaurants.map((r) => {
            const active = selectedId === r.id;
            const initial = r.name.charAt(0).toUpperCase();
            return (
              <Pressable
                key={r.id}
                onPress={() => handleSelectLocation(r.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: active ? primaryColor : borderColor,
                  backgroundColor: active ? primaryColor : "transparent",
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: active ? "rgba(255,255,255,0.2)" : `${primaryColor}18`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: active ? "rgba(255,255,255,0.9)" : primaryColor,
                    }}
                  >
                    {initial}
                  </ThemedText>
                </View>
                <ThemedText
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: active ? "#fff" : mutedColor,
                  }}
                >
                  {r.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Booking action buttons ──────────────────────────────────── */}
      {selectedRestaurant && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            disabled={pausing}
            onPress={async () => {
              setPausing(true);
              if (isPaused) {
                await unpauseRestaurantBookings(selectedRestaurant.id);
                setAllRestaurants((prev) =>
                  prev.map((r) =>
                    r.id === selectedRestaurant.id ? { ...r, bookingsPausedUntil: undefined } : r
                  )
                );
              } else {
                await pauseRestaurantBookings(selectedRestaurant.id, 60);
                setAllRestaurants((prev) =>
                  prev.map((r) =>
                    r.id === selectedRestaurant.id
                      ? {
                          ...r,
                          bookingsPausedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        }
                      : r
                  )
                );
              }
              setPausing(false);
            }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: BORDER_RADIUS.md,
              borderWidth: 1,
              borderColor: isPaused ? "#16a34a" : "#ca8a04",
              backgroundColor: isPaused ? "rgba(22,163,74,0.08)" : "rgba(234,179,8,0.08)",
              opacity: pausing ? 0.5 : 1,
              minHeight: 44,
            }}
          >
            <Ionicons
              name={isPaused ? "play-circle-outline" : "pause-circle-outline"}
              size={15}
              color={isPaused ? "#16a34a" : "#ca8a04"}
            />
            <ThemedText
              style={{ fontSize: 13, fontWeight: "600", color: isPaused ? "#16a34a" : "#ca8a04" }}
            >
              {pausing ? "Saving…" : isPaused ? `Resume (until ${pausedUntilText})` : "Pause 1h"}
            </ThemedText>
          </Pressable>

          <Pressable
            disabled={extending || extendNoActive}
            onPress={async () => {
              if (extendedBookings !== null) {
                setExtendedBookings(null);
                setExtendNoActive(false);
                return;
              }
              setExtending(true);
              setExtendNoActive(false);
              const result = await extendRestaurantBookings(selectedRestaurant.id, 60);
              setExtending(false);
              if (result.ok) {
                if (result.extendedBookings.length > 0) {
                  setExtendedBookings(result.extendedBookings);
                } else {
                  setExtendNoActive(true);
                }
              }
            }}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 10,
              borderRadius: BORDER_RADIUS.md,
              borderWidth: 1,
              borderColor: borderColor,
              opacity: extending || extendNoActive ? 0.5 : 1,
              minHeight: 44,
            }}
          >
            <Ionicons
              name="timer-outline"
              size={15}
              color={extendedBookings !== null ? mutedColor : primaryColor}
            />
            <ThemedText
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: extendedBookings !== null ? mutedColor : primaryColor,
              }}
            >
              {extending
                ? "Extending…"
                : extendedBookings !== null
                  ? `Extended ${extendedBookings.length} · Clear`
                  : extendNoActive
                    ? "No active bookings"
                    : "Extend 60m"}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {/* ── Location detail or empty state ───────────────────────────── */}
      {restaurants.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 72,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 1,
              borderColor,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 4,
            }}
          >
            <Ionicons name="storefront-outline" size={28} color={mutedColor} />
          </View>
          <ThemedText style={{ fontSize: 16, fontWeight: "700", textAlign: "center" }}>
            No locations yet
          </ThemedText>
          <ThemedText
            style={{
              fontSize: 14,
              color: mutedColor,
              textAlign: "center",
              maxWidth: 280,
              lineHeight: 22,
            }}
          >
            Add your first location to start accepting bookings.
          </ThemedText>
        </View>
      ) : selectedRestaurant ? (
        <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
          <LocationCard
            key={selectedRestaurant.id}
            restaurant={selectedRestaurant}
            onSaved={(patch) => patchRestaurant(selectedRestaurant.id, patch)}
            isDark={isDark}
            borderColor={borderColor}
            mutedColor={mutedColor}
            confirmAction={confirmAction}
          />
        </View>
      ) : null}

      {/* ── Archive / Delete ─────────────────────────────────────────── */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          ARCHIVE / DELETE
        </ThemedText>
        <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
          <Pressable
            style={styles.secHeader}
            onPress={() => {
              setDangerZoneExpanded((v) => !v);
              if (dangerZoneExpanded) {
                setDeleteStep("idle");
                setDeleteError(false);
                setArchiveError(false);
              }
            }}
          >
            <View style={[styles.secIcon, { backgroundColor: "rgba(220,38,38,0.1)" }]}>
              <Ionicons name="warning-outline" size={20} color="#dc2626" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.secTitle}>Archive or delete a location</ThemedText>
              <ThemedText style={[styles.secSub, { color: mutedColor }]}>
                {dangerSelectedRestaurant
                  ? `Selected: ${dangerSelectedRestaurant.name}${dangerSelectedRestaurant.isArchived ? " (archived)" : ""}`
                  : "Permanently remove or hide a location"}
              </ThemedText>
            </View>
            <Ionicons
              name={dangerZoneExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={mutedColor}
            />
          </Pressable>

          <AnimatedAccordion expanded={dangerZoneExpanded}>
            <View style={[styles.secForm, { borderTopColor: borderColor, gap: 16 }]}>
              {allRestaurants.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}
                >
                  {allRestaurants.map((r) => {
                    const active = dangerSelectedId === r.id;
                    const archived = r.isArchived ?? false;
                    const pillColor = archived ? mutedColor : "#dc2626";
                    return (
                      <Pressable
                        key={r.id}
                        onPress={() => handleDangerSelect(r.id)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 7,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 9999,
                          borderWidth: 1,
                          borderColor: active ? pillColor : borderColor,
                          backgroundColor: active ? pillColor : "transparent",
                          opacity: archived ? 0.65 : 1,
                        }}
                      >
                        <Ionicons
                          name={archived ? "archive-outline" : "storefront-outline"}
                          size={13}
                          color={active ? "#fff" : pillColor}
                        />
                        <ThemedText
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: active ? "#fff" : mutedColor,
                            textDecorationLine: archived ? "line-through" : "none",
                          }}
                        >
                          {r.name}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {dangerSelectedRestaurant ? (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(217,119,6,0.3)" : "rgba(217,119,6,0.2)",
                      borderRadius: 10,
                      backgroundColor: isDark ? "rgba(217,119,6,0.06)" : "rgba(217,119,6,0.03)",
                    }}
                  >
                    <View style={[styles.secIcon, { backgroundColor: "rgba(217,119,6,0.12)" }]}>
                      <Ionicons
                        name={
                          dangerSelectedRestaurant.isArchived
                            ? "refresh-outline"
                            : "archive-outline"
                        }
                        size={20}
                        color="#d97706"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.secRowTitle}>
                        {dangerSelectedRestaurant.isArchived
                          ? "Restore Location"
                          : "Archive Location"}
                      </ThemedText>
                      <ThemedText style={[styles.secRowSub, { color: mutedColor }]}>
                        {dangerSelectedRestaurant.isArchived
                          ? `Restore "${dangerSelectedRestaurant.name}" so customers can book again. All data is intact.`
                          : `Hide "${dangerSelectedRestaurant.name}" from customers. All data is preserved and can be restored at any time.`}
                      </ThemedText>
                      {archiveError && (
                        <ThemedText style={{ fontSize: 12, color: "#d97706", marginTop: 4 }}>
                          Failed. Please try again.
                        </ThemedText>
                      )}
                    </View>
                    <Pressable
                      disabled={archiving}
                      onPress={async () => {
                        setArchiving(true);
                        setArchiveError(false);
                        const target = !dangerSelectedRestaurant.isArchived;
                        const ok = await adminSetRestaurantArchived(
                          dangerSelectedRestaurant.id,
                          target
                        );
                        setArchiving(false);
                        if (ok) {
                          setAllRestaurants((prev) =>
                            prev.map((r) =>
                              r.id === dangerSelectedRestaurant.id
                                ? { ...r, isArchived: target }
                                : r
                            )
                          );
                          if (target) {
                            setRestaurants((prev) => {
                              const remaining = prev.filter(
                                (r) => r.id !== dangerSelectedRestaurant.id
                              );
                              if (selectedId === dangerSelectedRestaurant.id) {
                                setSelectedId(remaining.length > 0 ? remaining[0].id : null);
                              }
                              return remaining;
                            });
                          } else {
                            fetchRestaurants().then((active) => {
                              setRestaurants(active);
                              setSelectedId(dangerSelectedRestaurant.id);
                            });
                          }
                        } else {
                          setArchiveError(true);
                        }
                      }}
                      style={[
                        styles.secBtn,
                        {
                          borderColor: "#d97706",
                          backgroundColor: isDark ? "rgba(217,119,6,0.1)" : "rgba(217,119,6,0.06)",
                          opacity: archiving ? 0.5 : 1,
                        },
                      ]}
                    >
                      <ThemedText style={[styles.secBtnText, { color: "#d97706" }]}>
                        {archiving
                          ? "Saving…"
                          : dangerSelectedRestaurant.isArchived
                            ? "Restore"
                            : "Archive…"}
                      </ThemedText>
                    </Pressable>
                  </View>

                  <View
                    style={{
                      padding: 14,
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(220,38,38,0.3)" : "rgba(220,38,38,0.2)",
                      borderRadius: 10,
                      backgroundColor: isDark ? "rgba(220,38,38,0.06)" : "rgba(220,38,38,0.03)",
                      gap: 12,
                    }}
                  >
                    {deleteStep === "idle" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[styles.secIcon, { backgroundColor: "rgba(220,38,38,0.1)" }]}>
                          <Ionicons name="trash-outline" size={20} color="#dc2626" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.secRowTitle}>Delete Location</ThemedText>
                          <ThemedText style={[styles.secRowSub, { color: mutedColor }]}>
                            Permanently removes &ldquo;{dangerSelectedRestaurant.name}&rdquo; and
                            all its sections, tables, and bookings.
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => setDeleteStep("confirm")}
                          style={[
                            styles.secBtn,
                            {
                              borderColor: "#dc2626",
                              backgroundColor: isDark
                                ? "rgba(220,38,38,0.1)"
                                : "rgba(220,38,38,0.06)",
                            },
                          ]}
                        >
                          <ThemedText style={[styles.secBtnText, { color: "#dc2626" }]}>
                            Delete…
                          </ThemedText>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                          <Ionicons
                            name="warning-outline"
                            size={18}
                            color="#dc2626"
                            style={{ marginTop: 1 }}
                          />
                          <ThemedText style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
                            <ThemedText style={{ fontWeight: "700" }}>
                              Delete &ldquo;{dangerSelectedRestaurant.name}&rdquo;?
                            </ThemedText>{" "}
                            All sections, tables, and bookings will be permanently destroyed. This
                            cannot be undone.
                          </ThemedText>
                        </View>
                        {deleteError && (
                          <ThemedText style={{ fontSize: 12, color: "#dc2626" }}>
                            Failed to delete. Please try again.
                          </ThemedText>
                        )}
                        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                          <Pressable
                            onPress={() => {
                              setDeleteStep("idle");
                              setDeleteError(false);
                            }}
                            disabled={deleting}
                            style={[styles.secBtn, { borderColor, opacity: deleting ? 0.5 : 1 }]}
                          >
                            <ThemedText style={[styles.secBtnText, { color: mutedColor }]}>
                              Cancel
                            </ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={async () => {
                              setDeleting(true);
                              setDeleteError(false);
                              const ok = await adminDeleteRestaurant(dangerSelectedRestaurant.id);
                              setDeleting(false);
                              if (ok) {
                                const deletedId = dangerSelectedRestaurant.id;
                                setAllRestaurants((prev) => prev.filter((r) => r.id !== deletedId));
                                setRestaurants((prev) => {
                                  const remaining = prev.filter((r) => r.id !== deletedId);
                                  setSelectedId(remaining.length > 0 ? remaining[0].id : null);
                                  return remaining;
                                });
                                setDangerSelectedId(null);
                                setDeleteStep("idle");
                              } else {
                                setDeleteError(true);
                              }
                            }}
                            disabled={deleting}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: "#dc2626",
                              opacity: deleting ? 0.7 : 1,
                            }}
                          >
                            {deleting && <ActivityIndicator size="small" color="#fff" />}
                            <ThemedText style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
                              {deleting ? "Deleting…" : "Yes, delete permanently"}
                            </ThemedText>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                </>
              ) : (
                <View style={{ paddingVertical: 20, alignItems: "center", gap: 6 }}>
                  <ThemedText style={{ fontSize: 13, color: mutedColor, fontStyle: "italic" }}>
                    Select a location above to see options.
                  </ThemedText>
                </View>
              )}
            </View>
          </AnimatedAccordion>
        </View>
      </View>

      <ConfirmModal
        visible={!!confirmState}
        title="Confirm"
        message={confirmState?.message ?? ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ScrollView>
  );
}
