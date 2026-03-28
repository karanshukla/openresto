import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { COLORS, getThemeColors } from "@/theme/theme";
import { TableDto, deleteTable, updateTable } from "@/api/restaurants";
import { styles } from "./settings.styles";

export function TableRow({
  table,
  restaurantId,
  sectionId,
  isDark,
  borderColor,
  onUpdated,
  onDeleted,
  confirmAction,
}: {
  table: TableDto;
  restaurantId: number;
  sectionId: number;
  isDark: boolean;
  borderColor: string;
  onUpdated: (t: TableDto) => void;
  onDeleted: () => void;
  confirmAction: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(table.name ?? "");
  const [draftSeats, setDraftSeats] = useState(String(table.seats));
  const [saving, setSaving] = useState(false);
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;

  if (!editing) {
    return (
      <View style={[styles.tableItemRow, { borderBottomColor: borderColor }]}>
        <View style={styles.tableInfo}>
          <ThemedText style={styles.tableName}>{table.name ?? `Table ${table.id}`}</ThemedText>
          <ThemedText style={[styles.tableSeats, { color: mutedColor }]}>
            {table.seats} seats
          </ThemedText>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            style={styles.smallBtn}
            onPress={() => {
              setDraftName(table.name ?? "");
              setDraftSeats(String(table.seats));
              setEditing(true);
            }}
          >
            <ThemedText style={[styles.smallBtnText, { color: COLORS.primary }]}>Edit</ThemedText>
          </Pressable>
          <Pressable
            style={styles.smallBtn}
            onPress={async () => {
              const ok = await confirmAction(
                `Delete table "${table.name ?? `Table ${table.id}`}"?`
              );
              if (!ok) return;
              const success = await deleteTable(restaurantId, sectionId, table.id);
              if (success) onDeleted();
            }}
          >
            <ThemedText style={styles.deleteText}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.tableItemRow, { borderBottomColor: borderColor }]}>
      <View style={styles.tableEditFields}>
        <Input
          value={draftName}
          onChangeText={setDraftName}
          placeholder="Name"
          style={styles.flex2}
        />
        <Input
          value={draftSeats}
          onChangeText={setDraftSeats}
          placeholder="Seats"
          keyboardType="numeric"
          style={styles.flex1}
        />
      </View>
      <View style={styles.rowActions}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
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
          <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
            {saving ? "…" : "Save"}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { borderWidth: 1, borderColor: `${COLORS.primary}30` }]}
          onPress={() => setEditing(false)}
        >
          <ThemedText style={[styles.actionBtnText, { color: COLORS.muted.light }]}>
            Cancel
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
