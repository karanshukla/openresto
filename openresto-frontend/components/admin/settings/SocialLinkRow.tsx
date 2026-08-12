import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import type { AdminSocialLinkDto } from "@/api/admin";
import { Icon, type IconName } from "@/components/common/Icon";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./SocialLinkRow.styles";

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
    <View style={[settingsStyles.tile, { backgroundColor: surface2, borderColor }]}>
      <View style={[settingsStyles.tileIcon, { backgroundColor: cardBg, borderColor }]}>
        <Icon name={link.iconKey as IconName} size="lg" color={primaryColor} />
      </View>
      <View style={settingsStyles.tileCopy}>
        <ThemedText style={settingsStyles.tileTitle}>{link.label}</ThemedText>
        <ThemedText style={[settingsStyles.tileSub, { color: mutedColor }]} numberOfLines={1}>
          {link.url}
        </ThemedText>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onEdit(link)}
          style={styles.actionBtn}
          accessibilityLabel={`Edit ${link.label}`}
        >
          <Icon name="pencil-outline" size="md" color={mutedColor} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(link.id)}
          style={styles.actionBtn}
          accessibilityLabel={`Delete ${link.label}`}
        >
          <Icon name="trash-outline" size="md" color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
}
