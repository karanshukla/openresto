import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { theme, getThemeColors } from "@/theme/theme";
import { TableDto, deleteTable, updateTable } from "@/api/restaurants";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
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
  const { primaryColor } = useAppTheme();

  if (!editing) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderBottomWidth: 1,
          borderBottomColor: borderColor,
          gap: 10,
        }}
      >
        <ThemedText style={{ flex: 1, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
          {table.name ?? `T${table.id}`}
        </ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minWidth: 36 }}>
          <Ionicons name="people-outline" size={11} color={mutedColor} />
          <ThemedText style={{ fontSize: 12, color: mutedColor }}>{table.seats}</ThemedText>
        </View>
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
        <Pressable
          style={styles.smallBtn}
          onPress={async () => {
            const ok = await confirmAction(`Delete table "${table.name ?? `Table ${table.id}`}"?`);
            if (!ok) return;
            const success = await deleteTable(restaurantId, sectionId, table.id);
            if (success) onDeleted();
          }}
        >
          <ThemedText style={[styles.smallBtnText, { color: theme.colors.error }]}>
            Delete
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
