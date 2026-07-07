import { useState } from "react";
import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { SectionDto, TableDto, updateSection, deleteSection, addTable } from "@/api/restaurants";
import { TableRow } from "./TableRow";
import { AddRow } from "./AddRow";
import { theme, getThemeColors } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./settings.styles";
import Input from "@/components/common/Input";

export function SectionBlock({
  section,
  restaurantId,
  isDark,
  borderColor,
  mutedColor,
  onSectionRenamed,
  onSectionDeleted,
  onTableAdded,
  onTableUpdated,
  onTableDeleted,
  confirmAction,
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
  confirmAction: (msg: string) => Promise<boolean>;
  onSectionRenamed: (name: string) => void;
  onSectionDeleted: () => void;
  onTableAdded: (t: TableDto) => void;
  onTableUpdated: (t: TableDto) => void;
  onTableDeleted: (id: number) => void;
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

  return (
    <View
      style={[
        styles.sectionBlock,
        {
          borderWidth: 1,
          borderColor,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: surface2,
          marginBottom: 8,
        },
      ]}
    >
      {/* Section header — surface background with border-bottom */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: cardBg,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
        }}
      >
        {/* Left: name / edit input */}
        <View style={{ flex: 1 }}>
          {editing ? (
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="e.g. Indoor, Patio"
              autoFocus
            />
          ) : (
            <ThemedText style={styles.editableValue}>{section.name}</ThemedText>
          )}
        </View>

        {/* Right: tables count + edit/save/delete actions */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {!editing && (
            <ThemedText style={{ fontSize: 12, color: mutedColor }}>
              {section.tables.length} tables · {totalSeats} seats
            </ThemedText>
          )}
          {editing ? (
            <>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: primaryColor }]}
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
                <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
                  {saving ? "…" : "Save"}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.smallBtn} onPress={() => setEditing(false)}>
                <ThemedText style={[styles.smallBtnText, { color: colors.muted }]}>
                  Cancel
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                testID="section-move-up-btn"
                accessibilityLabel={`Move ${section.name} section up`}
                accessibilityHint="Moves this section earlier in the display order"
                style={{ padding: 6 }}
                disabled={isFirst || moveDisabled}
                onPress={() => {
                  if (!isFirst) onMoveUp();
                }}
              >
                <Ionicons
                  name="arrow-up-outline"
                  size={16}
                  color={isFirst ? mutedColor : primaryColor}
                />
              </Pressable>
              <Pressable
                testID="section-move-down-btn"
                accessibilityLabel={`Move ${section.name} section down`}
                accessibilityHint="Moves this section later in the display order"
                style={{ padding: 6 }}
                disabled={isLast || moveDisabled}
                onPress={() => {
                  if (!isLast) onMoveDown();
                }}
              >
                <Ionicons
                  name="arrow-down-outline"
                  size={16}
                  color={isLast ? mutedColor : primaryColor}
                />
              </Pressable>
              <Pressable
                testID="section-edit-btn"
                style={styles.smallBtn}
                onPress={() => {
                  setDraft(section.name);
                  setEditing(true);
                }}
              >
                <ThemedText style={[styles.smallBtnText, { color: primaryColor }]}>Edit</ThemedText>
              </Pressable>
              <Pressable
                testID="section-delete-btn"
                style={styles.smallBtn}
                onPress={async () => {
                  const ok = await confirmAction(
                    `Delete section "${section.name}" and all its tables?`
                  );
                  if (!ok) return;
                  const success = await deleteSection(restaurantId, section.id);
                  if (success) onSectionDeleted();
                }}
              >
                <ThemedText style={[styles.smallBtnText, { color: theme.colors.error }]}>
                  Delete
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Table list */}
      <View>
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
            confirmAction={confirmAction}
          />
        ))}
        {section.tables.length === 0 && (
          <ThemedText style={[styles.emptyNote, { color: mutedColor, padding: 12 }]}>
            No tables yet.
          </ThemedText>
        )}
      </View>

      {/* Add table */}
      <View style={{ padding: 12 }}>
        <AddRow
          label="Add Table"
          placeholder="Table name (e.g. T1, Booth 1)"
          extraPlaceholder="Seats"
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
