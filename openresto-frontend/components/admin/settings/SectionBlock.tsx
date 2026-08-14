import { useMemo, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import {
  SectionDto,
  TableDto,
  TableGroupDto,
  updateSection,
  deleteSection,
  addTable,
  fetchSectionDeleteImpact,
  createTableGroup,
  updateTableGroup,
  deleteTableGroup,
} from "@/api/restaurants";
import { TableRow, TableRowGroupContext } from "./TableRow";
import { AddRow } from "./AddRow";
import { RowIconButton } from "./RowIconButton";
import { RowTextButton } from "./RowTextButton";
import { theme, getThemeColors } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { buildSeatOptions } from "@/utils/seatOptions";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./SectionBlock.styles";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import { Icon } from "@/components/common/Icon";

export function SectionBlock({
  section,
  restaurantId,
  isDark,
  borderColor,
  mutedColor,
  groups,
  onSectionRenamed,
  onSectionDeleted,
  onTableAdded,
  onTableUpdated,
  onTableDeleted,
  onGroupsChanged,
  isFirst,
  isLast,
  moveDisabled,
  onMoveUp,
  onMoveDown,
}: {
  section: SectionDto;
  restaurantId: number;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  /** Restaurant-level combinable groups (#273); SectionBlock renders the ones touching this section. */
  groups: TableGroupDto[];
  onSectionRenamed: (name: string) => void;
  onSectionDeleted: () => void;
  onTableAdded: (t: TableDto) => void;
  onTableUpdated: (t: TableDto) => void;
  onTableDeleted: (id: number) => void;
  /** Replace the restaurant's full group list after a create/update/delete/dissolve. */
  onGroupsChanged: (groups: TableGroupDto[]) => void;
  isFirst: boolean;
  isLast: boolean;
  moveDisabled?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { primaryColor } = useAppTheme();
  const surface2 = isDark ? "#252729" : "#f9fafb";
  const cardBg = isDark ? "#1e2022" : "#ffffff";
  const totalSeats = section.tables.reduce((s, t) => s + t.seats, 0);
  const colors = getThemeColors(isDark);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.name);
  const [saving, setSaving] = useState(false);
  // Two-step delete friction (#270) — same inline pattern as TableRow/DangerZone. `Delete…` reveals
  // an inline confirmation naming the consequence (incl. the count of future bookings that would lose
  // their section/table reference); a second explicit tap destroys. `impact` is best-effort.
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [impact, setImpact] = useState<number | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Combinable groups (#273) ──────────────────────────────────────────────
  // Selection mode: the admin taps Link on a standalone table, then picks other standalone tables
  // to combine into a new group. `linkingFromId` is the source table; `selectedIds` the checked set.
  const [linkingFromId, setLinkingFromId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [combining, setCombining] = useState(false);
  // Inline edit for a group's combined seats.
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [draftCombinedSeats, setDraftCombinedSeats] = useState("");

  const sectionTableIds = useMemo(() => new Set(section.tables.map((t) => t.id)), [section.tables]);

  // Groups that have at least one member in this section. A group is rendered inside every section
  // it touches (selection is within one section, so in practice all members are same-section).
  const sectionGroups = useMemo(
    () => groups.filter((g) => g.members.some((m) => sectionTableIds.has(m.id))),
    [groups, sectionTableIds]
  );

  // tableId → its group, for quick chip rendering on rows.
  const tableIdToGroup = useMemo(() => {
    const map = new Map<number, TableGroupDto>();
    for (const g of groups) for (const m of g.members) map.set(m.id, g);
    return map;
  }, [groups]);

  function groupLabel(g: TableGroupDto): string {
    return g.name
      ? `${g.name} (${g.combinedSeats} seats)`
      : `Tables ${g.members.map((m) => m.name ?? m.id).join(" + ")} (${g.combinedSeats} combined)`;
  }

  function groupContextFor(tableId: number): TableRowGroupContext | undefined {
    const g = tableIdToGroup.get(tableId);
    return g ? { id: g.id, label: groupLabel(g), combinedSeats: g.combinedSeats } : undefined;
  }

  /**
   * Combined-seats window the server accepts for a member set: more than the largest member (else
   * combining gains nothing) and no more than their sum (pushing tables together can lose a cover
   * where the corners meet, never gain one). Mirrors ValidateCombinedSeats.
   */
  function combinedSeatsRange(memberSeats: number[]) {
    return { min: Math.max(...memberSeats) + 1, max: memberSeats.reduce((a, b) => a + b, 0) };
  }

  const startLink = (tableId: number) => {
    setLinkingFromId(tableId);
    setSelectedIds(new Set([tableId]));
  };

  const cancelLink = () => {
    setLinkingFromId(null);
    setSelectedIds(new Set());
  };

  const toggleSelect = (tableId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const confirmCombine = async () => {
    const memberIds = Array.from(selectedIds);
    if (memberIds.length < 2) return;
    setCombining(true);
    const sumSeats = memberIds.reduce(
      (sum, id) => sum + (section.tables.find((t) => t.id === id)?.seats ?? 0),
      0
    );
    const created = await createTableGroup(restaurantId, {
      members: memberIds,
      combinedSeats: sumSeats,
    });
    setCombining(false);
    if (created) {
      onGroupsChanged([...groups, created]);
      cancelLink();
    }
  };

  const handleUnlink = async (tableId: number) => {
    const g = tableIdToGroup.get(tableId);
    if (!g) return;
    const remaining = g.members.filter((m) => m.id !== tableId).map((m) => m.id);
    if (remaining.length < 2) {
      // Dissolve — a one-table group is meaningless. Delete the group entirely.
      const ok = await deleteTableGroup(restaurantId, g.id);
      if (ok) onGroupsChanged(groups.filter((x) => x.id !== g.id));
    } else {
      // Seats come off the group's own members, not this section's tables — a group rendered here
      // may still reach into another section, and a missing lookup would silently score it 0 seats.
      const { min, max } = combinedSeatsRange(
        g.members.filter((m) => remaining.includes(m.id)).map((m) => m.seats)
      );
      const updated = await updateTableGroup(restaurantId, g.id, {
        name: g.name ?? null,
        members: remaining,
        // The removed table's covers are gone, so the old combined figure may now exceed what the
        // remaining tables can seat — clamp it back into the accepted window.
        combinedSeats: Math.min(Math.max(g.combinedSeats, min), max),
      });
      if (updated) onGroupsChanged(groups.map((x) => (x.id === g.id ? updated : x)));
    }
  };

  const saveCombinedSeats = async (groupId: number) => {
    const seats = parseInt(draftCombinedSeats, 10);
    const g = groups.find((x) => x.id === groupId);
    if (isNaN(seats) || seats < 1 || !g) return;
    const updated = await updateTableGroup(restaurantId, groupId, {
      name: g.name ?? null,
      members: g.members.map((m) => m.id),
      combinedSeats: seats,
    });
    if (updated) onGroupsChanged(groups.map((x) => (x.id === groupId ? updated : x)));
    setEditingGroupId(null);
  };

  const startSectionDelete = async () => {
    setDeleteStep("confirm");
    setImpact(null);
    setImpactLoading(true);
    const result = await fetchSectionDeleteImpact(restaurantId, section.id);
    setImpact(result?.bookings ?? null);
    setImpactLoading(false);
  };

  const cancelSectionDelete = () => {
    setDeleteStep("idle");
    setImpact(null);
    setImpactLoading(false);
  };

  const confirmSectionDelete = async () => {
    setDeleting(true);
    const success = await deleteSection(restaurantId, section.id);
    setDeleting(false);
    if (success) onSectionDeleted();
  };

  const inSelectionMode = linkingFromId !== null;

  return (
    <View
      style={[settingsStyles.sectionBlock, styles.card, { borderColor, backgroundColor: surface2 }]}
    >
      {/* Section header — surface background with border-bottom. Name + count subtitle on the
          left, a tidy cluster of icon actions on the right (consistent with the table tiles and
          the rest of the settings cards). Editing state swaps to a name Input + text Save/Cancel. */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        {/* Left: name / edit input + count subtitle */}
        <View style={styles.headerCopy}>
          {editing ? (
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="e.g. Indoor, Patio"
              autoFocus
            />
          ) : (
            <>
              <ThemedText style={settingsStyles.editableValue}>{section.name}</ThemedText>
              <ThemedText style={[styles.headerSub, { color: mutedColor }]}>
                {section.tables.length} tables · {totalSeats} seats
                {sectionGroups.length > 0
                  ? ` · ${sectionGroups.length} combinable group${sectionGroups.length > 1 ? "s" : ""}`
                  : ""}
              </ThemedText>
            </>
          )}
        </View>

        {/* Right: edit/save/delete actions — gap 8 to match the table-row trailing cluster. */}
        <View style={styles.headerActions}>
          {editing ? (
            <>
              <Pressable
                style={[settingsStyles.actionBtn, { backgroundColor: primaryColor }]}
                disabled={saving}
                onPress={async () => {
                  if (!draft.trim()) return;
                  setSaving(true);
                  const result = await updateSection(restaurantId, section.id, draft.trim());
                  if (result) onSectionRenamed(result.name);
                  setSaving(false);
                  setEditing(false);
                }}
              >
                <ThemedText style={[settingsStyles.actionBtnText, { color: "#fff" }]}>
                  {saving ? "…" : "Save"}
                </ThemedText>
              </Pressable>
              <Pressable style={settingsStyles.smallBtn} onPress={() => setEditing(false)}>
                <ThemedText style={[settingsStyles.smallBtnText, { color: colors.muted }]}>
                  Cancel
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <RowIconButton
                testID="section-move-up-btn"
                name="arrow-up-outline"
                color={isFirst ? mutedColor : primaryColor}
                disabled={isFirst || moveDisabled}
                onPress={() => {
                  if (!isFirst) onMoveUp();
                }}
                accessibilityLabel={`Move ${section.name} section up`}
                accessibilityHint="Moves this section earlier in the display order"
              />
              <RowIconButton
                testID="section-move-down-btn"
                name="arrow-down-outline"
                color={isLast ? mutedColor : primaryColor}
                disabled={isLast || moveDisabled}
                onPress={() => {
                  if (!isLast) onMoveDown();
                }}
                accessibilityLabel={`Move ${section.name} section down`}
                accessibilityHint="Moves this section later in the display order"
              />
              <RowTextButton
                testID="section-edit-btn"
                label="Edit"
                icon="pencil-outline"
                color={primaryColor}
                onPress={() => {
                  setDraft(section.name);
                  setEditing(true);
                }}
                accessibilityLabel={`Rename ${section.name} section`}
              />
              <RowTextButton
                testID="section-delete-btn"
                label="Delete"
                icon="trash-outline"
                color={theme.colors.error}
                disabled={deleteStep === "confirm"}
                onPress={startSectionDelete}
                accessibilityLabel={`Delete ${section.name} section`}
              />
            </>
          )}
        </View>
      </View>

      {/* Inline two-step delete confirmation (#270) — sits between the header and the table list so
          the consequence is visible in context. Cancel returns to the header without destroying. */}
      {deleteStep === "confirm" && (
        <View
          style={[
            styles.confirmBanner,
            {
              borderBottomColor: borderColor,
              backgroundColor: isDark
                ? hexToRgba(theme.colors.error, 0.08)
                : hexToRgba(theme.colors.error, 0.04),
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
                Delete section &ldquo;{section.name}&rdquo; and all its tables?
              </ThemedText>{" "}
              {impactLoading
                ? ""
                : impact && impact > 0
                  ? `${impact} future ${impact === 1 ? "booking" : "bookings"} affected.`
                  : "Future bookings in this section will lose their reference."}{" "}
              This cannot be undone.
            </ThemedText>
          </View>
          <View style={settingsStyles.confirmActions}>
            <Pressable
              testID="section-delete-cancel-btn"
              style={[settingsStyles.smallBtn, { borderColor, opacity: deleting ? 0.5 : 1 }]}
              onPress={cancelSectionDelete}
              disabled={deleting}
            >
              <ThemedText style={[settingsStyles.smallBtnText, { color: mutedColor }]}>
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              testID="section-delete-confirm-btn"
              disabled={deleting}
              onPress={confirmSectionDelete}
              style={[settingsStyles.confirmDeleteBtn, { opacity: deleting ? 0.7 : 1 }]}
            >
              {deleting && <ActivityIndicator size="small" color="#fff" />}
              <ThemedText
                style={[settingsStyles.smallBtnText, settingsStyles.confirmDeleteBtnText]}
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Combine-selection header (#273) — shown while the admin is building a new group. Lists the
          source table and offers Cancel / Combine. The table rows below become checkboxes. */}
      {inSelectionMode && (
        <View
          style={[
            styles.selectionBar,
            {
              borderBottomColor: borderColor,
              backgroundColor: isDark
                ? hexToRgba(primaryColor, 0.1)
                : hexToRgba(primaryColor, 0.06),
            },
          ]}
        >
          <ThemedText style={[styles.selectionLabel, { color: primaryColor }]}>
            Select tables to combine with &ldquo;
            {section.tables.find((t) => t.id === linkingFromId)?.name ?? `T${linkingFromId}`}
            &rdquo; ({selectedIds.size} selected)
          </ThemedText>
          <Pressable style={settingsStyles.smallBtn} onPress={cancelLink} disabled={combining}>
            <ThemedText style={[settingsStyles.smallBtnText, { color: mutedColor }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            testID="section-combine-btn"
            style={[
              settingsStyles.actionBtn,
              {
                backgroundColor: primaryColor,
                opacity: selectedIds.size < 2 || combining ? 0.5 : 1,
              },
            ]}
            disabled={selectedIds.size < 2 || combining}
            onPress={confirmCombine}
          >
            {combining ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={[settingsStyles.actionBtnText, { color: "#fff" }]}>
                Combine
              </ThemedText>
            )}
          </Pressable>
        </View>
      )}

      {/* Group combined-seats edit affordance (#273) */}
      {editingGroupId !== null &&
        (() => {
          const g = groups.find((x) => x.id === editingGroupId);
          if (!g) return null;
          return (
            <View
              style={[
                styles.groupEditBar,
                {
                  borderBottomColor: borderColor,
                  backgroundColor: isDark
                    ? hexToRgba(primaryColor, 0.1)
                    : hexToRgba(primaryColor, 0.06),
                },
              ]}
            >
              <ThemedText style={[styles.groupEditLabel, { color: primaryColor }]}>
                Edit combined seats · {groupLabel(g)}
              </ThemedText>
              <View style={styles.groupEditRow}>
                <View style={styles.groupEditSelect}>
                  <Select
                    selectedValue={parseInt(draftCombinedSeats, 10) || undefined}
                    onSelect={(v) => setDraftCombinedSeats(String(v))}
                    options={(() => {
                      const { min, max } = combinedSeatsRange(g.members.map((m) => m.seats));
                      return buildSeatOptions(min, max);
                    })()}
                    placeholder={String(g.combinedSeats)}
                  />
                </View>
                <Pressable style={settingsStyles.smallBtn} onPress={() => setEditingGroupId(null)}>
                  <ThemedText style={[settingsStyles.smallBtnText, { color: mutedColor }]}>
                    Cancel
                  </ThemedText>
                </Pressable>
                <Pressable
                  testID="group-save-combined-btn"
                  style={[settingsStyles.actionBtn, { backgroundColor: primaryColor }]}
                  onPress={() => saveCombinedSeats(g.id)}
                >
                  <ThemedText style={[settingsStyles.actionBtnText, { color: "#fff" }]}>
                    Save
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          );
        })()}

      {/* Table list — tiles with breathing room (rows are now rounded surface tiles, not
          divider-separated). */}
      <View style={styles.tableList}>
        {section.tables.map((t) => (
          <TableRow
            key={t.id}
            table={t}
            restaurantId={restaurantId}
            sectionId={section.id}
            isDark={isDark}
            borderColor={borderColor}
            onUpdated={onTableUpdated}
            onDeleted={() => onTableDeleted(t.id)}
            group={groupContextFor(t.id)}
            onLink={() => startLink(t.id)}
            onUnlink={() => handleUnlink(t.id)}
            selectionMode={inSelectionMode}
            selected={selectedIds.has(t.id)}
            onToggleSelect={() => toggleSelect(t.id)}
            disabledInSelection={!!tableIdToGroup.get(t.id)}
          />
        ))}
        {section.tables.length === 0 && (
          <View style={[settingsStyles.emptyState, { borderColor }]}>
            <Icon name="grid-outline" size={22} color={mutedColor} />
            <ThemedText style={[settingsStyles.emptyStateText, { color: mutedColor }]}>
              No tables yet.
            </ThemedText>
          </View>
        )}
      </View>

      {/* Per-group combined-seats edit trigger (#273) — a compact bordered chip under each group. */}
      {sectionGroups.map((g) => (
        <Pressable
          key={`group-edit-${g.id}`}
          testID={`group-edit-btn-${g.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${groupLabel(g)} combined seats`}
          style={[
            styles.groupEditTrigger,
            {
              borderColor: hexToRgba(primaryColor, 0.4),
              backgroundColor: hexToRgba(primaryColor, 0.06),
            },
          ]}
          onPress={() => {
            setEditingGroupId(g.id);
            setDraftCombinedSeats(String(g.combinedSeats));
          }}
        >
          <Icon name="create-outline" size={13} color={primaryColor} />
          <ThemedText style={[styles.groupEditTriggerText, { color: primaryColor }]}>
            Edit &ldquo;{groupLabel(g)}&rdquo; combined seats
          </ThemedText>
        </Pressable>
      ))}

      {/* Add table */}
      <View style={styles.addTableRow}>
        <AddRow
          label="Add Table"
          placeholder="Table name (e.g. T1, Booth 1)"
          extraPlaceholder="Seats"
          extraOptions={buildSeatOptions()}
          onAdd={async (name, extra) => {
            const seats = parseInt(extra ?? "2", 10);
            const result = await addTable(restaurantId, section.id, {
              name,
              seats: isNaN(seats) ? 2 : seats,
            });
            if (result) onTableAdded(result);
          }}
        />
      </View>
    </View>
  );
}
