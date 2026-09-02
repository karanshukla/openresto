import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ScreenHeading.styles";

/**
 * A guest screen's own title and lead-in.
 *
 * Off web the title is dropped: the native Stack header already names the screen, so drawing
 * it again put the same words on the page twice, once in the bar and once under it. The
 * subtitle stays either way — it carries the sentence the header bar has no room for, and no
 * header shows it.
 *
 * @see [ScreenHeading.test.tsx](../../tests/components/layout/ScreenHeading.test.tsx) — pins
 * the split: both on web, subtitle only off it.
 */
export default function ScreenHeading({
  title,
  subtitle,
  style,
}: {
  title: string;
  subtitle: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.header, style]} testID="screen-heading">
      {Platform.OS === "web" && <ThemedText style={styles.title}>{title}</ThemedText>}
      <ThemedText style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</ThemedText>
    </View>
  );
}
