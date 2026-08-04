import { useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import { theme, getThemeColors } from "@/theme/theme";
import { TableDto, deleteTable, updateTable, fetchTableDeleteImpact } from "@/api/restaurants";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { buildSeatOptions } from "@/utils/seatOptions";
import { styles } from "./settings.styles";
import { RowIconButton } from "./RowIconButton";
import { RowTextButton } from "./RowTextButton";

/**
 * Group membership context for a table row (#273). When present, the row renders inside a
 * combinable group: a ⛓ chip with the group label and a remove (unlink) affordance.
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
  const [draftSeats, setDraftSeats] = useState(table.seats);
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
  // Surface tokens shared with SocialLinkRow / HighlightsCard so the table tiles are visually
  // indistinguishable from the rest of the settings cards.
  const surface2 = isDark ? "#252729" : "#f9fafb";
  const cardBg = isDark ? "#1e2022" : "#ffffff";

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

  // Selection mode (#273): render a checkable tile for combining tables into a group. Already-grouped
  // tables (disabledInSelection) are shown disabled with their chip; standalone tiles are selectable.
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
          gap: 12,
          padding: 12,
          borderWidth: 1,
          borderColor,
          borderRadius: 10,
          opacity: isGrouped ? 0.45 : 1,
          backgroundColor: selected ? hexToRgba(primaryColor, 0.08) : surface2,
        }}
      >
        <Ionicons
          name={isGrouped ? "lock-closed" : selected ? "checkbox" : "square-outline"}
          size={16}
          color={isGrouped ? mutedColor : primaryColor}
        />
        <View style={{ flex: 1 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
            {table.name ?? `T${table.id}`}
          </ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Ionicons name="people-outline" size={12} color={mutedColor} />
            <ThemedText style={{ fontSize: 12, color: mutedColor }}>
              {table.seats} seat{table.seats === 1 ? "" : "s"}
            </ThemedText>
            {isGrouped && group && (
              <View
                testID={`table-group-chip-${table.id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginLeft: 6,
                  backgroundColor: hexToRgba(primaryColor, 0.12),
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: theme.borderRadius.full,
                }}
              >
                <Ionicons name="link" size={11} color={primaryColor} />
                <ThemedText style={{ fontSize: 11, color: primaryColor, fontWeight: "600" }}>
                  {group.label}
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  // Inline two-step delete confirmation (#270) — a tinted tile that replaces the row so the
  // consequence is visible in context. Cancel returns to the row without destroying.
  if (!editing && deleteStep === "confirm") {
    return (
      <View
        style={{
          padding: 12,
          borderWidth: 1,
          borderColor: hexToRgba(theme.colors.error, 0.4),
          borderRadius: 10,
          gap: 10,
          backgroundColor: isDark
            ? hexToRgba(theme.colors.error, 0.1)
            : hexToRgba(theme.colors.error, 0.05),
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

  // Default row — a surface tile (matches SocialLinkRow / HighlightsCard): leading icon square,
  // name + seats subtitle, trailing cluster of icon actions. Grouped rows append a remove-on-the-chip
  // and skip the combine action.
  if (!editing) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 12,
          backgroundColor: surface2,
          borderWidth: 1,
          borderColor,
          borderRadius: 10,
        }}
      >
        {/* Leading icon square */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: cardBg,
            borderWidth: 1,
            borderColor,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Ionicons name={group ? "link" : "grid-outline"} size={18} color={primaryColor} />
        </View>

        {/* Title + subtitle (seats, and the group chip when grouped) */}
        <View style={{ flex: 1 }}>
          <ThemedText style={{ fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
            {table.name ?? `T${table.id}`}
          </ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <Ionicons name="people-outline" size={12} color={mutedColor} />
            <ThemedText style={{ fontSize: 12, color: mutedColor }}>
              {table.seats} seat{table.seats === 1 ? "" : "s"}
            </ThemedText>
            {group && (
              <View
                testID={`table-group-chip-${table.id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginLeft: 4,
                  backgroundColor: hexToRgba(primaryColor, 0.14),
                  paddingLeft: 8,
                  paddingRight: 2,
                  paddingVertical: 2,
                  borderRadius: theme.borderRadius.full,
                }}
              >
                <Ionicons name="link" size={11} color={primaryColor} />
                <ThemedText style={{ fontSize: 11, color: primaryColor, fontWeight: "600" }}>
                  {group.label}
                </ThemedText>
                <Pressable
                  testID={`table-unlink-btn-${table.id}`}
                  onPress={onUnlink}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tableName} from group`}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={{ padding: 2 }}
                >
                  <Ionicons name="close" size={12} color={primaryColor} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Trailing actions — mix of text pill (Edit) and icon buttons (combine/delete); gap 8 keeps
            the cluster tight and visually balanced across the two button types. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!group && (
            <RowIconButton
              testID={`table-link-btn-${table.id}`}
              name="link-outline"
              color={primaryColor}
              onPress={onLink}
              accessibilityLabel={`Combine ${tableName} into a group`}
            />
          )}
          <RowTextButton
            testID={`table-edit-btn-${table.id}`}
            label="Edit"
            icon="pencil-outline"
            color={mutedColor}
            onPress={() => {
              setDraftName(table.name ?? "");
              setDraftSeats(table.seats);
              setEditing(true);
            }}
            accessibilityLabel={`Edit ${tableName}`}
          />
          <RowIconButton
            testID={`table-delete-btn-${table.id}`}
            name="trash-outline"
            color={theme.colors.error}
            onPress={startDelete}
            accessibilityLabel={`Delete ${tableName}`}
          />
        </View>
      </View>
    );
  }

  // Edit mode — full-width inline form (kept intact; Save/Cancel are text buttons by design).
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
          <Select
            selectedValue={draftSeats}
            onSelect={(v) => setDraftSeats(v as number)}
            options={buildSeatOptions()}
            placeholder="Seats"
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
            setSaving(true);
            const result = await updateTable(restaurantId, sectionId, table.id, {
              name: draftName.trim() || undefined,
              seats: draftSeats,
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
