import { useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { theme, getThemeColors } from "@/theme/theme";
import { TableDto, deleteTable, updateTable, fetchTableDeleteImpact } from "@/api/restaurants";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { styles } from "./settings.styles";

/**
 * Group membership context for a table row (#273). When present, the row renders inside a
 * combinable group: a ⛓ chip with the group label and an Unlink button instead of Link.
 */
export interface TableRowGroupContext {
  id: number;
  /** Pre-formatted chip label, e.g. "Tables 8 + 9 (8 combined)" or "Window booths (8 seats)". */
  label: string;
  combinedSeats: number;
}

export function TableRow({
  table,
  restaurantId,
  sectionId,
  isDark,
  borderColor,
  onUpdated,
  onDeleted,
  group,
  onLink,
  onUnlink,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  disabledInSelection = false,
}: {
  table: TableDto;
  restaurantId: number;
  sectionId: number;
  isDark: boolean;
  borderColor: string;
  onUpdated: (t: TableDto) => void;
  onDeleted: () => void;
  /** Group membership context; undefined when the table is standalone. */
  group?: TableRowGroupContext;
  /** Enter selection mode to start a new group from this table. Standalone rows only. */
  onLink?: () => void;
  /** Remove this table from its group. Grouped rows only. */
  onUnlink?: () => void;
  /** True while SectionBlock is in combine-selection mode. */
  selectionMode?: boolean;
  /** Whether this row is currently selected in selection mode. */
  selected?: boolean;
  /** Toggle selection in selection mode. */
  onToggleSelect?: () => void;
  /** Disabled (already grouped) in selection mode. */
  disabledInSelection?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(table.name ?? "");
  const [draftSeats, setDraftSeats] = useState(String(table.seats));
  const [saving, setSaving] = useState(false);
  // Two-step delete friction (#270) — mirrors DangerZone's deleteStep pattern. `Delete…` reveals
  // an inline confirmation (not a center-screen modal) that names the consequence and requires a
  // second explicit tap to destroy. `impact` is the best-effort count of future bookings that would
  // lose their table reference; null = still loading or unavailable → generic copy fallback.
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [impact, setImpact] = useState<number | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;
  const { primaryColor } = useAppTheme();

  const tableName = table.name ?? `Table ${table.id}`;

  const startDelete = async () => {
    setDeleteStep("confirm");
    setImpact(null);
    setImpactLoading(true);
    const result = await fetchTableDeleteImpact(restaurantId, sectionId, table.id);
    // Best-effort: a failure/404 leaves impact at null and the UI falls back to generic copy
    // rather than blocking the destructive action.
    setImpact(result?.bookings ?? null);
    setImpactLoading(false);
  };

  const cancelDelete = () => {
    setDeleteStep("idle");
    setImpact(null);
    setImpactLoading(false);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const success = await deleteTable(restaurantId, sectionId, table.id);
    setDeleting(false);
    if (success) onDeleted();
  };

  // Selection mode (#273): render a checkable row for combining tables into a group. Already-grouped
  // tables (disabledInSelection) are shown disabled with their chip; standalone tables are selectable.
  if (selectionMode) {
    const isGrouped = !!group || disabledInSelection;
    return (
      <Pressable
        testID={`table-select-row-${table.id}`}
        onPress={isGrouped ? undefined : onToggleSelect}
        disabled={isGrouped}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          gap: 10,
          opacity: isGrouped ? 0.45 : 1,
          backgroundColor: selected ? hexToRgba(primaryColor, 0.08) : "transparent",
        }}
      >
        <Ionicons
          name={isGrouped ? "lock-closed" : selected ? "checkbox" : "square-outline"}
          size={16}
          color={isGrouped ? mutedColor : primaryColor}
        />
        <ThemedText style={{ flex: 1, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
          {table.name ?? `T${table.id}`}
        </ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 36 }}>
          <Ionicons name="people-outline" size={11} color={mutedColor} />
          <ThemedText style={{ fontSize: 12, color: mutedColor }}>{table.seats}</ThemedText>
        </View>
        {isGrouped && group && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: hexToRgba(primaryColor, 0.12),
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: theme.borderRadius.full,
            }}
          >
            <Ionicons name="link" size={11} color={primaryColor} />
            <ThemedText style={{ fontSize: 11, color: primaryColor, fontWeight: "600" }}>
              {group.label}
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  }

  if (!editing && deleteStep === "confirm") {
    return (
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          gap: 10,
          backgroundColor: isDark
            ? hexToRgba(theme.colors.error, 0.08)
            : hexToRgba(theme.colors.error, 0.04),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Ionicons
            name="warning-outline"
            size={15}
            color={theme.colors.error}
            style={{ marginTop: 1 }}
          />
          <ThemedText style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
            <ThemedText style={{ fontWeight: "700" }}>Delete &ldquo;{tableName}&rdquo;?</ThemedText>{" "}
            {impactLoading
              ? "This will permanently remove the table."
              : impact && impact > 0
                ? `${impact} future ${impact === 1 ? "booking" : "bookings"} will lose ${impact === 1 ? "its" : "their"} table reference.`
                : "Future bookings on this table will lose their reference."}{" "}
            This cannot be undone.
          </ThemedText>
        </View>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
          <Pressable
            testID="table-delete-cancel-btn"
            style={[styles.smallBtn, { borderColor, opacity: deleting ? 0.5 : 1 }]}
            onPress={cancelDelete}
            disabled={deleting}
          >
            <ThemedText style={[styles.smallBtnText, { color: mutedColor }]}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            testID="table-delete-confirm-btn"
            disabled={deleting}
            onPress={confirmDelete}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: theme.borderRadius.md,
              backgroundColor: theme.colors.error,
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting && <ActivityIndicator size="small" color="#fff" />}
            <ThemedText style={[styles.smallBtnText, { color: "#fff", fontWeight: "700" }]}>
              {deleting ? "Deleting…" : "Yes, delete"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!editing) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: group ? 12 : 14,
          paddingVertical: 11,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          gap: 10,
          backgroundColor: group
            ? isDark
              ? hexToRgba(primaryColor, 0.1)
              : hexToRgba(primaryColor, 0.06)
            : "transparent",
        }}
      >
        <ThemedText style={{ flex: 1, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
          {table.name ?? `T${table.id}`}
        </ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 36 }}>
          <Ionicons name="people-outline" size={11} color={mutedColor} />
          <ThemedText style={{ fontSize: 12, color: mutedColor }}>{table.seats}</ThemedText>
        </View>
        {group ? (
          <>
            <View
              testID={`table-group-chip-${table.id}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: hexToRgba(primaryColor, 0.14),
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: theme.borderRadius.full,
              }}
            >
              <Ionicons name="link" size={11} color={primaryColor} />
              <ThemedText style={{ fontSize: 11, color: primaryColor, fontWeight: "600" }}>
                {group.label}
              </ThemedText>
            </View>
            <Pressable
              testID={`table-unlink-btn-${table.id}`}
              style={styles.smallBtn}
              onPress={onUnlink}
            >
              <ThemedText style={[styles.smallBtnText, { color: mutedColor }]}>Unlink</ThemedText>
            </Pressable>
          </>
        ) : (
          <Pressable testID={`table-link-btn-${table.id}`} style={styles.smallBtn} onPress={onLink}>
            <ThemedText style={[styles.smallBtnText, { color: primaryColor }]}>Link</ThemedText>
          </Pressable>
        )}
        <Pressable
          style={styles.smallBtn}
          onPress={() => {
            setDraftName(table.name ?? "");
            setDraftSeats(String(table.seats));
            setEditing(true);
          }}
        >
          <ThemedText style={[styles.smallBtnText, { color: mutedColor }]}>Edit</ThemedText>
        </Pressable>
        <Pressable style={styles.smallBtn} onPress={startDelete}>
          <ThemedText style={[styles.smallBtnText, { color: theme.colors.error }]}>
            Delete…
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  // Edit mode — full-width inline form
  return (
    <View
      style={{
        width: "100%",
        borderWidth: 1,
        borderRadius: 10,
        borderColor: primaryColor,
        padding: 12,
        gap: 10,
        backgroundColor: isDark ? hexToRgba(primaryColor, 0.08) : hexToRgba(primaryColor, 0.04),
      }}
    >
      <ThemedText
        style={{ fontSize: 11, fontWeight: "700", color: primaryColor, letterSpacing: 0.5 }}
      >
        EDITING · {table.name ?? `Table ${table.id}`}
      </ThemedText>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 2, gap: 4 }}>
          <ThemedText style={{ fontSize: 11, fontWeight: "600", color: mutedColor }}>
            NAME
          </ThemedText>
          <Input value={draftName} onChangeText={setDraftName} placeholder="e.g. Table 1" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <ThemedText style={{ fontSize: 11, fontWeight: "600", color: mutedColor }}>
            SEATS
          </ThemedText>
          <Input
            value={draftSeats}
            onChangeText={setDraftSeats}
            placeholder="4"
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
        <Pressable style={styles.smallBtn} onPress={() => setEditing(false)}>
          <ThemedText style={{ color: mutedColor, fontSize: 13, fontWeight: "600" }}>
            Cancel
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: primaryColor, paddingHorizontal: 16 }]}
          disabled={saving}
          onPress={async () => {
            const seats = parseInt(draftSeats, 10);
            if (isNaN(seats) || seats < 1) return;
            setSaving(true);
            const result = await updateTable(restaurantId, sectionId, table.id, {
              name: draftName.trim() || undefined,
              seats,
            });
            setSaving(false);
            if (result) {
              onUpdated(result);
              setEditing(false);
            }
          }}
        >
          <ThemedText style={[styles.actionBtnText, { color: "#fff", fontWeight: "700" }]}>
            {saving ? "Saving…" : "Save"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
