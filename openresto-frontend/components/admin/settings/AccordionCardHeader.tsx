import { type ReactNode } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { styles as settingsStyles } from "./settings.styles";
import { Icon, type IconName } from "@/components/common/Icon";

/**
 * The icon/title/subtitle/chevron trigger shared by every collapsible settings card (brand
 * settings, email, users, account and the locations page alike), so the two admin surfaces
 * read as one system. It owns the icon tint in particular: hand-rolled copies of this header
 * had drifted to three different alphas, which put the same chrome on screen at three
 * different weights depending on which settings route you were on.
 */
export function AccordionCardHeader({
  icon,
  iconColor,
  title,
  subtitle,
  subtitleColor,
  expanded,
  onToggle,
  primaryColor,
  mutedColor,
  trailing,
}: {
  icon: IconName;
  /** Overrides the brand colour when the glyph itself carries state (push permission). */
  iconColor?: string;
  title: string;
  subtitle: string;
  /** Overrides the muted default when the subtitle carries state (a warning). */
  subtitleColor?: string;
  expanded: boolean;
  onToggle: () => void;
  primaryColor: string;
  mutedColor: string;
  /** Replaces the chevron — only for a card that has something to say while it loads. */
  trailing?: ReactNode;
}) {
  const glyphColor = iconColor ?? primaryColor;

  return (
    <Pressable
      style={settingsStyles.secHeader}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
    >
      <View style={[settingsStyles.secIcon, { backgroundColor: `${glyphColor}18` }]}>
        <Icon name={icon} size="xl" color={glyphColor} />
      </View>
      <View style={settingsStyles.secHeaderCopy}>
        <ThemedText style={settingsStyles.secTitle}>{title}</ThemedText>
        <ThemedText
          style={[settingsStyles.secSub, { color: subtitleColor ?? mutedColor }]}
          numberOfLines={1}
        >
          {subtitle}
        </ThemedText>
      </View>
      {trailing ?? (
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      )}
    </Pressable>
  );
}
