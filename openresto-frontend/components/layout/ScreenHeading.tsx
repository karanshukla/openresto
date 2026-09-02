import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ScreenHeading.styles";

/**
 * A guest screen's own title and lead-in.
 *
 * Off web the title is dropped unless the screen is `standalone`: a screen under a native
 * Stack header is already named by the bar, so drawing the title again put the same words on
 * the page twice. A tab root draws with no header at all — the tab bar is the way between the
 * roots, and a back arrow on one reads as a website — so there the heading is the screen's top
 * and carries the title at the size the web page uses. The settings control is not in it: it
 * is pinned outside the scroll view by `GuestSettingsAnchor`, and the title reserves the band
 * it occupies rather than sharing a row with it. The subtitle stays either way; it carries the
 * sentence no header has room for.
 *
 * @see [ScreenHeading.test.tsx](../../tests/components/layout/ScreenHeading.test.tsx) — pins
 * the split: both on web, subtitle only under a header, title clearing the pinned control on
 * a root.
 */
export default function ScreenHeading({
  title,
  subtitle,
  standalone = false,
  style,
}: {
  title: string;
  subtitle: string;
  /** The screen draws with no native header, so the heading is its top. Web ignores this. */
  standalone?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const onWeb = Platform.OS === "web";

  return (
    <View style={[styles.header, style]} testID="screen-heading">
      {(onWeb || standalone) && (
        <ThemedText style={[styles.title, !onWeb && styles.titleClearsSettings]}>
          {title}
        </ThemedText>
      )}
      <ThemedText style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</ThemedText>
    </View>
  );
}
