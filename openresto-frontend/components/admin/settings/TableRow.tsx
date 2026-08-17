import { useState } from "react";
import { View, Pressable } from "react-native";
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
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { RowTextButton } from "@/components/common/RowTextButton";
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

/**
 * One table in the admin's section list, in four mutually exclusive modes: selection (picking
 * tables to combine), delete confirmation, edit, and the default row.
 *
 * Destroying a table is two taps, and the confirmation replaces the row in place rather than
 * opening a centre-screen modal, so the consequence it names — the count of future bookings that
 * would lose their table reference — is read next to the table it applies to.
 */
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
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  /** Null while loading, and when the read fails — the confirmation falls back to generic copy. */
  const [impact, setImpact] = useState<number | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;
  const { primaryColor } = useAppTheme();

  const tableName = table.name ?? `Table ${table.id}`;
  // Shared with SocialLinkRow / HighlightsCard so the table tiles are indistinguishable from the
  // rest of the settings cards.
  const surface2 = isDark ? "#252729" : "#f9fafb";
  const cardBg = isDark ? "#1e2022" : "#ffffff";

  const startDelete = async () => {
    setDeleteStep("confirm");
    setImpact(null);
    setImpactLoading(true);
    const result = await fetchTableDeleteImpact(restaurantId, sectionId, table.id);
    // Best-effort: a failed read must not block the destructive action behind a count.
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

  // A table already in a group keeps its chip but is locked: a table belongs to one group.
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
        <ButtonRow>
          <Button
            testID="table-delete-cancel-btn"
            variant="secondary"
            tone="neutral"
            size="md"
            onPress={cancelDelete}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            testID="table-delete-confirm-btn"
            tone="danger"
            size="md"
            disabled={deleting}
            loading={deleting}
            onPress={confirmDelete}
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
        </ButtonRow>
      </View>
    );
  }

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
      <ButtonRow style={styles.editActions}>
        <Button
          variant="secondary"
          tone="neutral"
          size="md"
          onPress={() => setEditing(false)}
          accessibilityLabel={`Cancel editing ${tableName}`}
        >
          Cancel
        </Button>
        <Button
          size="md"
          disabled={saving}
          loading={saving}
          accessibilityLabel={`Save ${tableName}`}
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
          {saving ? "Saving…" : "Save"}
        </Button>
      </ButtonRow>
    </View>
  );
}
