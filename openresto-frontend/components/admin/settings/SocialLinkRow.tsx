import { type ComponentProps } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import type { AdminSocialLinkDto } from "@/api/admin";

export interface SocialLinkRowProps {
  link: AdminSocialLinkDto;
  onEdit: (link: AdminSocialLinkDto) => void;
  onDelete: (id: number) => void;
  primaryColor: string;
  cardBg: string;
  borderColor: string;
  mutedColor: string;
  surface2: string;
}

/**
 * The display-mode row for a single social link in the FooterSettingsCard list — icon + label +
 * url + the edit/delete action buttons. Presentational: receives the link + callbacks. Extracted
 * during Bundle 9B-3 decomposition.
 */
export function SocialLinkRow({
  link,
  onEdit,
  onDelete,
  primaryColor,
  cardBg,
  borderColor,
  mutedColor,
  surface2,
}: SocialLinkRowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        backgroundColor: surface2,
        borderWidth: 1,
        borderColor,
        borderRadius: 10,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: cardBg,
          borderWidth: 1,
          borderColor,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Ionicons
          name={link.iconKey as ComponentProps<typeof Ionicons>["name"]}
          size={18}
          color={primaryColor}
        />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={{ fontSize: 14, fontWeight: "600" }}>{link.label}</ThemedText>
        <ThemedText style={{ fontSize: 12, color: mutedColor, marginTop: 2 }} numberOfLines={1}>
          {link.url}
        </ThemedText>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Pressable
          onPress={() => onEdit(link)}
          style={{ padding: 6 }}
          accessibilityLabel={`Edit ${link.label}`}
        >
          <Ionicons name="pencil-outline" size={16} color={mutedColor} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(link.id)}
          style={{ padding: 6 }}
          accessibilityLabel={`Delete ${link.label}`}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
}
