import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { theme, getThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./settings.styles";

export function EditableRow({
  value,
  onSave,
  onDelete,
  placeholder,
  deleteLabel: _deleteLabel = "Delete",
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
  const { primaryColor } = useAppTheme();

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
              style={[styles.smallBtn, { paddingHorizontal: 6 }]}
              onPress={async () => {
                const ok = await confirmAction(`Delete "${value}"? This cannot be undone.`);
                if (ok) await onDelete();
              }}
            >
              <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
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
          style={[styles.actionBtn, { backgroundColor: primaryColor }]}
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
        <Pressable style={styles.smallBtn} onPress={() => setEditing(false)}>
          <Ionicons name="close-outline" size={20} color={mutedColor} />
        </Pressable>
      </View>
    </View>
  );
}
