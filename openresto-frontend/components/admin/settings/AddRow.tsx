import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { theme } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
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

  const { primaryColor } = useAppTheme();

  // Collapsed — a self-sized filled-primary pill, aligned right (matches the Add CTA pattern in
  // HighlightsCard: `alignSelf: flex-start` there is left; here we right-align per the settings
  // table/section layout). Keeps the verbatim label so callers' tests keep resolving it.
  if (!open) {
    return (
      <Pressable
        style={{
          backgroundColor: primaryColor,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "flex-end",
        }}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="add" size={16} color="#fff" />
        <ThemedText style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>{label}</ThemedText>
      </Pressable>
    );
  }

  // Expanded — inputs + a right-aligned footer: filled-primary text Add and a bordered close (X)
  // icon so the dismiss affordance is consistent with the rest of the row actions.
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
      <View
        style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", alignItems: "center" }}
      >
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
          style={[styles.actionBtn, { backgroundColor: primaryColor, opacity: saving ? 0.6 : 1 }]}
        >
          <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
            {saving ? "Adding…" : "Add"}
          </ThemedText>
        </Pressable>
        <Pressable
          style={{
            padding: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.colors.border.light,
          }}
          onPress={() => {
            setOpen(false);
            setName("");
            setExtra("");
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel add"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={theme.colors.muted.light} />
        </Pressable>
      </View>
    </View>
  );
}
