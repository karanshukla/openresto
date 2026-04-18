import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { COLORS } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useBrand } from "@/context/BrandContext";
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

  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  if (!open) {
    return (
      <Pressable
        style={[styles.addBtn, { backgroundColor: primaryColor }]}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="add-circle-outline" size={16} color="#fff" />
        <ThemedText style={styles.addBtnText}>{label}</ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={styles.addForm}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: extraPlaceholder ? 3 : 1 }}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={placeholder ?? "Name"}
            autoFocus
          />
        </View>
        {extraPlaceholder && (
          <View style={{ flex: 1 }}>
            <Input
              value={extra}
              onChangeText={setExtra}
              placeholder={extraPlaceholder}
              keyboardType="numeric"
            />
          </View>
        )}
      </View>
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
          style={[styles.actionBtn, { backgroundColor: primaryColor, paddingHorizontal: 16 }]}
        >
          <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
            {saving ? "Adding…" : "Add"}
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.smallBtn, { padding: 8 }]}
          onPress={() => {
            setOpen(false);
            setName("");
            setExtra("");
          }}
        >
          <Ionicons name="close-outline" size={20} color={COLORS.muted.light} />
        </Pressable>
      </View>
    </View>
  );
}
