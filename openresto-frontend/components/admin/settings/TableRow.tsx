import { useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import { theme, getThemeColors } from "@/theme/theme";
import { TableDto, deleteTable, updateTable, fetchTableDeleteImpact } from "@/api/restaurants";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { buildSeatOptions } from "@/utils/seatOptions";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./TableRow.styles";
import { RowTextButton } from "./RowTextButton";
import { Icon } from "@/components/common/Icon";

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
        style={[
          styles.selectTile,
          {
            borderColor,
            backgroundColor: selected ? hexToRgba(primaryColor, 0.08) : surface2,
          },
          isGrouped && styles.selectTileLocked,
        ]}
      >
        <Icon
          name={isGrouped ? "lock-closed" : selected ? "checkbox" : "square-outline"}
          size="md"
          color={isGrouped ? mutedColor : primaryColor}
        />
        <View style={settingsStyles.tileCopy}>
          <ThemedText style={settingsStyles.tileTitle} numberOfLines={1}>
            {table.name ?? `T${table.id}`}
          </ThemedText>
          <View style={styles.seatsRow}>
            <Icon name="people-outline" size="xs" color={mutedColor} />
            <ThemedText style={[styles.seatsText, { color: mutedColor }]}>
              {table.seats} seat{table.seats === 1 ? "" : "s"}
            </ThemedText>
            {isGrouped && group && (
              <View
                testID={`table-group-chip-${table.id}`}
                style={[
                  styles.groupChip,
                  styles.groupChipSelect,
                  { backgroundColor: hexToRgba(primaryColor, 0.12) },
                ]}
              >
                <Icon name="link" size={11} color={primaryColor} />
                <ThemedText style={[styles.groupChipText, { color: primaryColor }]}>
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
        style={[
          styles.confirmTile,
          {
            borderColor: hexToRgba(theme.colors.error, 0.4),
            backgroundColor: isDark
              ? hexToRgba(theme.colors.error, 0.1)
              : hexToRgba(theme.colors.error, 0.05),
          },
        ]}
      >
        <View style={settingsStyles.confirmCopy}>
          <Icon
            name="warning-outline"
            size={15}
            color={theme.colors.error}
            style={settingsStyles.confirmIcon}
          />
          <ThemedText style={settingsStyles.confirmText}>
            <ThemedText style={settingsStyles.confirmTextStrong}>
              Delete &ldquo;{tableName}&rdquo;?
            </ThemedText>{" "}
            {impactLoading
              ? "This will permanently remove the table."
              : impact && impact > 0
                ? `${impact} future ${impact === 1 ? "booking" : "bookings"} will lose ${impact === 1 ? "its" : "their"} table reference.`
                : "Future bookings on this table will lose their reference."}{" "}
            This cannot be undone.
          </ThemedText>
        </View>
        <View style={settingsStyles.confirmActions}>
          <Pressable
            testID="table-delete-cancel-btn"
            style={[settingsStyles.smallBtn, { borderColor, opacity: deleting ? 0.5 : 1 }]}
            onPress={cancelDelete}
            disabled={deleting}
          >
            <ThemedText style={[settingsStyles.smallBtnText, { color: mutedColor }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            testID="table-delete-confirm-btn"
            disabled={deleting}
            onPress={confirmDelete}
            style={[settingsStyles.confirmDeleteBtn, { opacity: deleting ? 0.7 : 1 }]}
          >
            {deleting && <ActivityIndicator size="small" color="#fff" />}
            <ThemedText style={[settingsStyles.smallBtnText, settingsStyles.confirmDeleteBtnText]}>
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
      <View style={[settingsStyles.tile, { backgroundColor: surface2, borderColor }]}>
        <View style={[settingsStyles.tileIcon, { backgroundColor: cardBg, borderColor }]}>
          <Icon name={group ? "link" : "grid-outline"} size="lg" color={primaryColor} />
        </View>

        <View style={settingsStyles.tileCopy}>
          <ThemedText style={settingsStyles.tileTitle} numberOfLines={1}>
            {table.name ?? `T${table.id}`}
          </ThemedText>
          <View style={styles.rowSeatsRow}>
            <Icon name="people-outline" size="xs" color={mutedColor} />
            <ThemedText style={[styles.seatsText, { color: mutedColor }]}>
              {table.seats} seat{table.seats === 1 ? "" : "s"}
            </ThemedText>
            {group && (
              <View
                testID={`table-group-chip-${table.id}`}
                style={[
                  styles.groupChip,
                  styles.groupChipRow,
                  { backgroundColor: hexToRgba(primaryColor, 0.14) },
                ]}
              >
                <Icon name="link" size={11} color={primaryColor} />
                <ThemedText style={[styles.groupChipText, { color: primaryColor }]}>
                  {group.label}
                </ThemedText>
                <Pressable
                  testID={`table-unlink-btn-${table.id}`}
                  onPress={onUnlink}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${tableName} from group`}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={styles.unlinkBtn}
                >
                  <Icon name="close" size="xs" color={primaryColor} />
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* Trailing actions: every one is a named pill. The admin runs on tablets, often for
            staff who do not use the app daily, so a bare glyph is not enough of a label. */}
        <View style={styles.rowActions}>
          {!group && (
            <RowTextButton
              testID={`table-link-btn-${table.id}`}
              label="Combine"
              icon="link-outline"
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
          <RowTextButton
            testID={`table-delete-btn-${table.id}`}
            label="Delete"
            icon="trash-outline"
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
      style={[
        styles.editCard,
        {
          borderColor: primaryColor,
          backgroundColor: isDark ? hexToRgba(primaryColor, 0.08) : hexToRgba(primaryColor, 0.04),
        },
      ]}
    >
      <ThemedText style={[styles.editHeading, { color: primaryColor }]}>
        EDITING · {table.name ?? `Table ${table.id}`}
      </ThemedText>
      <View style={styles.editFields}>
        <View style={styles.editNameField}>
          <ThemedText style={[styles.editFieldLabel, { color: mutedColor }]}>NAME</ThemedText>
          <Input value={draftName} onChangeText={setDraftName} placeholder="e.g. Table 1" />
        </View>
        <View style={styles.editSeatsField}>
          <ThemedText style={[styles.editFieldLabel, { color: mutedColor }]}>SEATS</ThemedText>
          <Select
            selectedValue={draftSeats}
            onSelect={(v) => setDraftSeats(v as number)}
            options={buildSeatOptions()}
            placeholder="Seats"
          />
        </View>
      </View>
      <View style={styles.editActions}>
        <Pressable style={settingsStyles.smallBtn} onPress={() => setEditing(false)}>
          <ThemedText style={[styles.editCancelText, { color: mutedColor }]}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          style={[settingsStyles.actionBtn, styles.editSaveBtn, { backgroundColor: primaryColor }]}
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
          <ThemedText style={[settingsStyles.actionBtnText, styles.editSaveText]}>
            {saving ? "Saving…" : "Save"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
