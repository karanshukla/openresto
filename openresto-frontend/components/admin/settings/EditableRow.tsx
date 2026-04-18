import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { COLORS, getThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useBrand } from "@/context/BrandContext";
import { styles } from "./settings.styles";

export function EditableRow({
  value,
  onSave,
  onDelete,
  placeholder,
  deleteLabel = "Delete",
  isDark,
  confirmAction,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  placeholder?: string;
  deleteLabel?: string;
  isDark: boolean;
  confirmAction: (msg: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  if (!editing) {
    return (
      <View style={styles.editableRow}>
        <ThemedText style={styles.editableValue}>{value}</ThemedText>
        <View style={styles.rowActions}>
          <Pressable
            style={styles.smallBtn}
            onPress={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <ThemedText style={[styles.smallBtnText, { color: primaryColor }]}>Edit</ThemedText>
          </Pressable>
          {onDelete && (
            <Pressable
              style={styles.smallBtn}
              onPress={async () => {
                const ok = await confirmAction(`Delete "${value}"? This cannot be undone.`);
                if (ok) await onDelete();
              }}
            >
              <ThemedText style={[styles.smallBtnText, { color: COLORS.error }]}>
                {deleteLabel}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.editableRow}>
      <View style={{ flex: 1 }}>
        <Input value={draft} onChangeText={setDraft} placeholder={placeholder} autoFocus />
      </View>
      <View style={styles.rowActions}>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: primaryColor, paddingHorizontal: 12 }]}
          disabled={saving}
          onPress={async () => {
            if (!draft.trim()) return;
            setSaving(true);
            await onSave(draft.trim());
            setSaving(false);
            setEditing(false);
          }}
        >
          <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
            {saving ? "…" : "Save"}
          </ThemedText>
        </Pressable>
        <Pressable style={[styles.smallBtn, { padding: 8 }]} onPress={() => setEditing(false)}>
          <Ionicons name="close-outline" size={20} color={mutedColor} />
        </Pressable>
      </View>
    </View>
  );
}
