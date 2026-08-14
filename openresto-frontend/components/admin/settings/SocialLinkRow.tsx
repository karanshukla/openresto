import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import type { AdminSocialLinkDto } from "@/api/admin";
import { Icon, type IconName } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { RowTextButton } from "@/components/common/RowTextButton";
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
        <RowTextButton
          label="Edit"
          icon="pencil-outline"
          color={mutedColor}
          onPress={() => onEdit(link)}
          accessibilityLabel={`Edit ${link.label}`}
        />
        <RowTextButton
          label="Delete"
          icon="trash-outline"
          color={theme.colors.error}
          onPress={() => onDelete(link.id)}
          accessibilityLabel={`Delete ${link.label}`}
        />
      </View>
    </View>
  );
}
