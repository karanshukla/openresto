import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { COLORS, getThemeColors } from "@/theme/theme";
import { TableDto, deleteTable, updateTable } from "@/api/restaurants";
import { Ionicons } from "@expo/vector-icons";
import { useBrand } from "@/context/BrandContext";
import { hexToRgba } from "@/utils/colors";
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
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  if (!editing) {
    return (
      <View
        style={[
          styles.tableItemRow,
          {
            borderBottomColor: borderColor,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderStyle: "dotted",
          },
        ]}
      >
        <View style={styles.tableInfo}>
          <View style={{ backgroundColor: `${primaryColor}10`, padding: 8, borderRadius: 8 }}>
            <Ionicons name="grid-outline" size={16} color={primaryColor} />
          </View>
          <View>
            <ThemedText style={styles.tableName}>{table.name ?? `Table ${table.id}`}</ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <ThemedText
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: mutedColor,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Table
              </ThemedText>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: mutedColor,
                  opacity: 0.5,
                }}
              />
              <ThemedText style={[styles.tableSeats, { color: mutedColor }]}>
                {table.seats} guests
              </ThemedText>
            </View>
          </View>
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
            <ThemedText style={[styles.smallBtnText, { color: primaryColor }]}>Edit</ThemedText>
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
            <ThemedText style={[styles.smallBtnText, { color: COLORS.error }]}>Delete</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.tableItemRow,
        {
          borderBottomColor: primaryColor,
          borderBottomWidth: 1,
          paddingVertical: 16,
          backgroundColor: isDark ? hexToRgba(primaryColor, 0.08) : hexToRgba(primaryColor, 0.03),
          marginHorizontal: -8,
          paddingHorizontal: 8,
          borderRadius: 8,
        },
      ]}
    >
      <View style={[styles.tableEditFields, { flexDirection: "column", gap: 8 }]}>
        <View style={{ gap: 4 }}>
          <ThemedText style={{ fontSize: 11, fontWeight: "700", color: primaryColor }}>
            TABLE NAME
          </ThemedText>
          <Input value={draftName} onChangeText={setDraftName} placeholder="e.g. Table 1" />
        </View>
        <View style={{ gap: 4 }}>
          <ThemedText style={{ fontSize: 11, fontWeight: "700", color: primaryColor }}>
            MAX GUESTS
          </ThemedText>
          <Input
            value={draftSeats}
            onChangeText={setDraftSeats}
            placeholder="Capacity"
            keyboardType="numeric"
          />
        </View>
      </View>
      <View style={[styles.rowActions, { alignSelf: "flex-end", marginTop: 12 }]}>
        <Pressable
          style={[
            styles.actionBtn,
            { backgroundColor: primaryColor, paddingHorizontal: 20, height: 40 },
          ]}
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
            {saving ? "…" : "SAVE TABLE"}
          </ThemedText>
        </Pressable>
        <Pressable style={[styles.smallBtn, { padding: 10 }]} onPress={() => setEditing(false)}>
          <ThemedText style={{ color: mutedColor, fontSize: 14, fontWeight: "600" }}>
            Cancel
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
