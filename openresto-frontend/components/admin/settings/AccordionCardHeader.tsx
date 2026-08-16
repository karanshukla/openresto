import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { styles as settingsStyles } from "./settings.styles";
import { Icon, type IconName } from "@/components/common/Icon";

/**
 * The icon/title/subtitle/chevron trigger shared by every collapsible settings card (brand
 * settings and the locations page alike), so the two admin surfaces read as one system.
 */
export function AccordionCardHeader({
  icon,
  title,
  subtitle,
  expanded,
  onToggle,
  primaryColor,
  mutedColor,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  primaryColor: string;
  mutedColor: string;
}) {
  return (
    <Pressable
      style={settingsStyles.secHeader}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded }}
    >
      <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}18` }]}>
        <Icon name={icon} size="xl" color={primaryColor} />
      </View>
      <View style={settingsStyles.secHeaderCopy}>
        <ThemedText style={settingsStyles.secTitle}>{title}</ThemedText>
        <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]} numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
    </Pressable>
  );
}
