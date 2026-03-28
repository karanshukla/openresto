import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { COLORS } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./settings.styles";

export function AddRow({
  label,
  placeholder,
  onAdd,
  extraPlaceholder,
}: {
  label: string;
  placeholder?: string;
  onAdd: (name: string, extra?: string) => Promise<void>;
  extraPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Pressable style={styles.addBtn} onPress={() => setOpen(true)}>
        <Ionicons name="add-circle-outline" size={16} color="#fff" />
        <ThemedText style={styles.addBtnText}>{label}</ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.addForm}>
      <Input value={name} onChangeText={setName} placeholder={placeholder ?? "Name"} />
      {extraPlaceholder && (
        <Input
          value={extra}
          onChangeText={setExtra}
          placeholder={extraPlaceholder}
          keyboardType="numeric"
        />
      )}
      <View style={styles.rowActions}>
        <Pressable
          onPress={async () => {
            if (!name.trim()) return;
            setSaving(true);
            await onAdd(name.trim(), extra || undefined);
            setSaving(false);
            setName("");
            setExtra("");
            setOpen(false);
          }}
          disabled={saving || !name.trim()}
          style={[styles.actionBtn, { backgroundColor: COLORS.primary }]}
        >
          <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
            {saving ? "Adding…" : "Add"}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { borderWidth: 1, borderColor: `${COLORS.primary}30` }]}
          onPress={() => {
            setOpen(false);
            setName("");
            setExtra("");
          }}
        >
          <ThemedText style={[styles.actionBtnText, { color: COLORS.muted.light }]}>
            Cancel
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
