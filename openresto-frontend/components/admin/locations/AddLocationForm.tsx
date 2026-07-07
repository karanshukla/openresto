import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";

export interface AddLocationFormProps {
  value: string;
  saving: boolean;
  /** Theme values passed from the orchestrating screen (presentational). */
  isDark: boolean;
  mutedColor: string;
  primaryColor: string;
  onValueChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Inline "add location" form — name input + Add button + cancel.
 * Extracted from the locations screen for decomposition; presentational,
 * owns no state (the screen drives the value + saving flag + handlers).
 */
export function AddLocationForm({
  value,
  saving,
  isDark,
  mutedColor,
  primaryColor,
  onValueChange,
  onSubmit,
  onCancel,
}: AddLocationFormProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: isDark ? `${primaryColor}40` : `${primaryColor}30`,
        borderRadius: theme.borderRadius.card,
        backgroundColor: isDark ? `${primaryColor}08` : `${primaryColor}04`,
      }}
    >
      <Ionicons name="storefront-outline" size={18} color={primaryColor} />
      <TextInput
        value={value}
        onChangeText={onValueChange}
        placeholder="Location name (e.g. Downtown, Westside)"
        placeholderTextColor={mutedColor}
        autoFocus
        style={{
          flex: 1,
          fontSize: 14,
          color: isDark ? "#fff" : "#111",
        }}
      />
      <Pressable
        disabled={saving || !value.trim()}
        onPress={onSubmit}
        style={{
          backgroundColor: primaryColor,
          borderRadius: theme.borderRadius.md,
          paddingHorizontal: 14,
          paddingVertical: 8,
          opacity: saving || !value.trim() ? 0.45 : 1,
        }}
      >
        <ThemedText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
          {saving ? "Adding…" : "Add"}
        </ThemedText>
      </Pressable>
      <Pressable testID="add-location-cancel" onPress={onCancel} style={{ padding: 6 }}>
        <Ionicons name="close-outline" size={20} color={mutedColor} />
      </Pressable>
    </View>
  );
}
