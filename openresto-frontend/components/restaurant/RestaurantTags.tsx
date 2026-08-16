import { View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgb } from "@/utils/colors";
import { styles } from "./RestaurantTags.styles";

// Tags are free text an admin can add without limit, so an uncapped row makes one card
// taller than the card beside it. Overflow collapses into a single +N chip instead.
const MAX_VISIBLE_TAGS = 3;

export function RestaurantTags({ tags, style }: { tags: string[]; style?: StyleProp<ViewStyle> }) {
  const { isDark, primaryColor } = useAppTheme();
  if (tags.length === 0) return null;

  const { r, g, b } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${r},${g},${b},${isDark ? 0.15 : 0.12})`;
  const visible = tags.slice(0, MAX_VISIBLE_TAGS);
  const hidden = tags.length - visible.length;

  return (
    <View testID="restaurant-tags" style={[styles.tags, style]}>
      {visible.map((tag) => (
        <View key={tag} style={[styles.tag, { backgroundColor: accentSoft }]}>
          <ThemedText style={[styles.tagText, { color: primaryColor }]}>{tag}</ThemedText>
        </View>
      ))}
      {hidden > 0 && (
        <View
          style={[styles.tag, { backgroundColor: accentSoft }]}
          accessibilityLabel={`${hidden} more ${hidden === 1 ? "tag" : "tags"}: ${tags
            .slice(MAX_VISIBLE_TAGS)
            .join(", ")}`}
        >
          <ThemedText style={[styles.tagText, { color: primaryColor }]}>{`+${hidden}`}</ThemedText>
        </View>
      )}
    </View>
  );
}
