import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { styles } from "@/components/admin/settings/settings.styles";
import { adminDeleteRestaurant, adminSetRestaurantArchived } from "@/api/admin";

/** Minimal restaurant record the danger zone needs (subset of the admin list shape). */
export interface DangerZoneRestaurant {
  id: number;
  name: string;
  isArchived?: boolean;
}

export interface DangerZoneProps {
  /** All restaurants (active + archived) shown as selection pills. */
  restaurants: DangerZoneRestaurant[];
  /** Theme values passed from the orchestrating screen (presentational). */
  borderColor: string;
  cardBg: string;
  mutedColor: string;
  isDark: boolean;
  /** Called after a successful archive/restore with the id + the new archived flag.
   *  The parent reconciles its active + all-restaurant lists (the original logic
   *  patches the all-list in place, and either filters or re-fetches the active list). */
  onArchived: (id: number, archived: boolean) => Promise<void>;
  /** Called after a successful delete with the id. The parent reconciles both lists. */
  onDeleted: (id: number) => Promise<void>;
}

/**
 * Archive / Delete section for the locations screen.
 *
 * Owns its internal UI state (expand, selected restaurant, delete step, error
 * flags, loading flags) and performs the API calls. Delegates the *data
 * reconciliation* (how the parent's active/all restaurant lists update after a
 * mutation) to the parent via `onArchived` / `onDeleted` callbacks — this keeps
 * the precise original reconciliation logic in the screen, where it has access
 * to both lists, while the UI + API orchestration lives here.
 *
 * Extracted from the locations screen for decomposition.
 */
export function DangerZone({
  restaurants,
  borderColor,
  cardBg,
  mutedColor,
  isDark,
  onArchived,
  onDeleted,
}: DangerZoneProps) {
  // Persisted so the admin's last expand/collapse choice survives a page reload.
  const [expanded, setExpanded] = usePersistedState("locations:danger:expanded", false);
  const [dangerSelectedId, setDangerSelectedId] = useState<number | null>(null);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(false);

  const dangerSelectedRestaurant = restaurants.find((r) => r.id === dangerSelectedId) ?? null;

  const handleSelect = (id: number) => {
    setDangerSelectedId(id);
    setDeleteStep("idle");
    setDeleteError(false);
    setArchiveError(false);
  };

  const handleArchive = async () => {
    if (!dangerSelectedRestaurant) return;
    setArchiving(true);
    setArchiveError(false);
    const target = !dangerSelectedRestaurant.isArchived;
    const ok = await adminSetRestaurantArchived(dangerSelectedRestaurant.id, target);
    setArchiving(false);
    if (ok) {
      await onArchived(dangerSelectedRestaurant.id, target);
    } else {
      setArchiveError(true);
    }
  };

  const handleDelete = async () => {
    if (!dangerSelectedRestaurant) return;
    setDeleting(true);
    setDeleteError(false);
    const ok = await adminDeleteRestaurant(dangerSelectedRestaurant.id);
    setDeleting(false);
    if (ok) {
      const deletedId = dangerSelectedRestaurant.id;
      setDangerSelectedId(null);
      setDeleteStep("idle");
      await onDeleted(deletedId);
    } else {
      setDeleteError(true);
    }
  };

  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
        ARCHIVE / DELETE
      </ThemedText>
      <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
        <Pressable
          style={styles.secHeader}
          onPress={() => {
            setExpanded((v) => !v);
            if (expanded) {
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
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
        </Pressable>

        <AnimatedAccordion expanded={expanded}>
          <View style={[styles.secForm, { borderTopColor: borderColor, gap: 16 }]}>
            {restaurants.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 2 }}
              >
                {restaurants.map((r) => {
                  const active = dangerSelectedId === r.id;
                  const archived = r.isArchived ?? false;
                  const pillColor = archived ? mutedColor : "#dc2626";
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => handleSelect(r.id)}
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
                        dangerSelectedRestaurant.isArchived ? "refresh-outline" : "archive-outline"
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
                    onPress={handleArchive}
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
                          Permanently removes &ldquo;{dangerSelectedRestaurant.name}&rdquo; and all
                          its sections, tables, and bookings.
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
                          onPress={handleDelete}
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
  );
}
