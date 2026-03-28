import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { COLORS, getThemeColors } from "@/theme/theme";
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
  const borderColor = colors.border;

  if (!editing) {
    return (
      <View style={[styles.editableRow, { borderBottomColor: borderColor }]}>
        <ThemedText style={styles.editableValue}>{value}</ThemedText>
        <View style={styles.rowActions}>
          <Pressable
            style={styles.smallBtn}
            onPress={() => {
              setDraft(value);
              setEditing(true);
            }}
          >
            <ThemedText style={[styles.smallBtnText, { color: COLORS.primary }]}>Edit</ThemedText>
          </Pressable>
          {onDelete && (
            <Pressable
              style={styles.smallBtn}
              onPress={async () => {
                const ok = await confirmAction(`Delete "${value}"? This cannot be undone.`);
                if (ok) await onDelete();
              }}
            >
              <ThemedText style={styles.deleteText}>{deleteLabel}</ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.editableRow, { borderBottomColor: borderColor }]}>
      <Input
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        style={styles.editableInput}
      />
      <View style={styles.rowActions}>
        <Pressable
          style={styles.smallBtn}
          disabled={saving}
          onPress={async () => {
            if (!draft.trim()) return;
            setSaving(true);
            await onSave(draft.trim());
            setSaving(false);
            setEditing(false);
          }}
        >
          <ThemedText style={[styles.smallBtnText, { color: COLORS.primary }]}>
            {saving ? "…" : "Save"}
          </ThemedText>
        </Pressable>
        <Pressable style={styles.smallBtn} onPress={() => setEditing(false)}>
          <ThemedText style={[styles.smallBtnText, { color: COLORS.muted.light }]}>
            Cancel
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
