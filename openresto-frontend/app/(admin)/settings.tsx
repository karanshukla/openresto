import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View, Platform, Pressable, TextInput } from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, getThemeColors } from "@/theme/theme";
import { fetchRestaurants, createRestaurant, RestaurantDto } from "@/api/restaurants";
import {
  adminDeleteRestaurant,
  adminGetRestaurants,
  adminSetRestaurantArchived,
} from "@/api/admin";
import { useBrand } from "@/context/BrandContext";

// Components
import { LocationCard } from "@/components/admin/settings/LocationCard";
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import { HighlightsCard } from "@/components/admin/settings/HighlightsCard";
import { PushNotificationsCard } from "@/components/admin/settings/PushNotificationsCard";
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

function LocationPills({
  restaurants,
  selectedId,
  onSelect,
  onAdd,
  primaryColor,
  borderColor,
  mutedColor,
  isDark,
}: {
  restaurants: RestaurantDto[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd?: () => void;
  primaryColor: string;
  borderColor: string;
  mutedColor: string;
  isDark: boolean;
}) {
  const surface2 = isDark ? "#252729" : "#f9fafb";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}
    >
      {restaurants.map((r) => {
        const active = selectedId === r.id;
        const initial = r.name.charAt(0).toUpperCase();
        return (
          <Pressable
            key={r.id}
            onPress={() => onSelect(r.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: active ? primaryColor : borderColor,
              backgroundColor: active ? primaryColor : surface2,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: active ? "rgba(255,255,255,0.2)" : `${primaryColor}18`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText
                style={{
                  fontSize: 10,
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
      {onAdd && (
        <Pressable
          onPress={onAdd}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 9999,
            borderWidth: 1,
            borderStyle: "dashed" as const,
            borderColor,
            backgroundColor: "transparent",
          }}
        >
          <Ionicons name="add" size={14} color={mutedColor} />
          <ThemedText style={{ fontSize: 13, color: mutedColor }}>Add location</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

export default function AdminSettingsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(true);
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);
  const [dangerSelectedId, setDangerSelectedId] = useState<number | null>(null);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(false);
  const [allRestaurants, setAllRestaurants] = useState<
    { id: number; name: string; isArchived?: boolean }[]
  >([]);
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

  function handleSelectLocation(id: number) {
    setSelectedId(id);
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
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Settings" }} />}

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <ThemedText type="h1">Settings</ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            Manage locations, brand, email, and security.
          </ThemedText>
        </View>
      </View>

      {/* Locations Section */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>LOCATIONS</ThemedText>
        <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
          <Pressable style={styles.secHeader} onPress={() => setLocationExpanded((v) => !v)}>
            <View style={[styles.secIcon, { backgroundColor: `${primaryColor}20` }]}>
              <Ionicons name="storefront-outline" size={20} color={primaryColor} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.secTitle}>Location Manager</ThemedText>
              <ThemedText style={[styles.secSub, { color: mutedColor }]}>
                {restaurants.length === 0
                  ? "0 locations configured"
                  : `${restaurants.length} location${restaurants.length !== 1 ? "s" : ""} configured · all active`}
              </ThemedText>
            </View>
            <Ionicons
              name={locationExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={mutedColor}
            />
          </Pressable>

          {locationExpanded && (
            <View style={[styles.secForm, { borderTopColor: borderColor, gap: 12 }]}>
              {restaurants.length > 0 ? (
                <View style={{ gap: 12 }}>
                  <LocationPills
                    restaurants={restaurants}
                    selectedId={selectedId}
                    onSelect={handleSelectLocation}
                    onAdd={() => setAddingLocation(true)}
                    primaryColor={primaryColor}
                    borderColor={borderColor}
                    mutedColor={mutedColor}
                    isDark={isDark}
                  />
                  {addingLocation && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        padding: 14,
                        borderWidth: 1,
                        borderColor,
                        borderRadius: 14,
                        backgroundColor: cardBg,
                      }}
                    >
                      <TextInput
                        value={newLocationName}
                        onChangeText={setNewLocationName}
                        placeholder="Location name (e.g. Downtown, Westside)"
                        placeholderTextColor={mutedColor}
                        autoFocus
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: isDark ? "#fff" : "#000",
                          borderWidth: 1,
                          borderColor,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
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
                          borderRadius: 8,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
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
                        style={{ padding: 8 }}
                      >
                        <Ionicons name="close-outline" size={20} color={mutedColor} />
                      </Pressable>
                    </View>
                  )}
                  {selectedRestaurant && (
                    <View
                      style={{
                        borderWidth: 1,
                        borderColor,
                        borderRadius: 14,
                        backgroundColor: cardBg,
                        overflow: "hidden",
                      }}
                    >
                      <LocationCard
                        key={selectedRestaurant.id}
                        restaurant={selectedRestaurant}
                        onSaved={(patch) => patchRestaurant(selectedRestaurant.id, patch)}
                        isDark={isDark}
                        borderColor={borderColor}
                        mutedColor={mutedColor}
                        cardBg={cardBg}
                        confirmAction={confirmAction}
                      />
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.emptyCard, { borderColor, backgroundColor: cardBg }]}>
                  <Ionicons name="storefront-outline" size={32} color={mutedColor} />
                  <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
                    No locations found
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Global Settings */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          GLOBAL SETTINGS
        </ThemedText>
        <BrandSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <HighlightsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <EmailSettingsCard
          borderColor={borderColor}
          mutedColor={mutedColor}
          cardBg={cardBg}
          isDark={isDark}
        />
        <PushNotificationsCard
          restaurantId={selectedId}
          borderColor={borderColor}
          mutedColor={mutedColor}
          cardBg={cardBg}
        />
      </View>

      {/* Account Security */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          ACCOUNT SECURITY
        </ThemedText>
        <SecurityCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
      </View>

      {/* Archive / Delete Restaurant Data */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          ARCHIVE / DELETE RESTAURANT DATA
        </ThemedText>
        <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
          {/* Collapsible header */}
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
              <ThemedText style={styles.secTitle}>Archive / Delete Location</ThemedText>
              <ThemedText style={[styles.secSub, { color: mutedColor }]}>
                {dangerSelectedRestaurant
                  ? `Selected: ${dangerSelectedRestaurant.name}${dangerSelectedRestaurant.isArchived ? " (archived)" : ""}`
                  : "Select a location to archive or permanently delete"}
              </ThemedText>
            </View>
            <Ionicons
              name={dangerZoneExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={mutedColor}
            />
          </Pressable>

          {dangerZoneExpanded && (
            <View style={[styles.secForm, { borderTopColor: borderColor, gap: 16 }]}>
              {/* Restaurant picker — shows all including archived */}
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
                    const surface2 = isDark ? "#252729" : "#f9fafb";
                    return (
                      <Pressable
                        key={r.id}
                        onPress={() => handleDangerSelect(r.id)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 7,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 9999,
                          borderWidth: 1,
                          borderColor: active ? pillColor : borderColor,
                          backgroundColor: active ? pillColor : surface2,
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
                  {/* Archive / Restore row */}
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
                            // Archiving: remove from active Location Manager list
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
                            // Restoring: re-fetch active list to get full restaurant data back
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

                  {/* Delete row */}
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
                <View
                  style={{
                    paddingVertical: 20,
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ThemedText style={{ fontSize: 13, color: mutedColor, fontStyle: "italic" }}>
                    Select a location above to see options.
                  </ThemedText>
                </View>
              )}
            </View>
          )}
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
