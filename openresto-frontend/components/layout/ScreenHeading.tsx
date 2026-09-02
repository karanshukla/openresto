import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgb } from "@/utils/colors";
import GuestSettingsMenu from "@/components/layout/GuestSettingsMenu";
import { styles } from "./ScreenHeading.styles";

/**
 * A guest screen's own title and lead-in.
 *
 * Off web the title is dropped unless the screen is `standalone`: a screen under a native
 * Stack header is already named by the bar, so drawing the title again put the same words on
 * the page twice. A tab root draws with no header at all — the tab bar is the way between the
 * roots, and a back arrow on one reads as a website — so there the heading is the screen's top:
 * the title at the size the web page uses, and the settings control the header used to carry.
 * The subtitle stays either way; it carries the sentence no header has room for.
 *
 * @see [ScreenHeading.test.tsx](../../tests/components/layout/ScreenHeading.test.tsx) — pins
 * the split: both on web, subtitle only under a header, title plus settings on a root.
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
  const { colors, primaryColor } = useAppTheme();

  if (Platform.OS !== "web" && standalone) {
    const accent = hexToRgb(primaryColor);
    return (
      <View style={[styles.header, style]} testID="screen-heading">
        <View style={styles.titleRow}>
          <ThemedText style={[styles.title, styles.titleGrow]}>{title}</ThemedText>
          <GuestSettingsMenu
            color={colors.muted}
            backgroundColor={`rgba(${accent.r},${accent.g},${accent.b},0.18)`}
            variant="tinted"
            testID="screen-heading-settings-open"
          />
        </View>
        <ThemedText style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.header, style]} testID="screen-heading">
      {Platform.OS === "web" && <ThemedText style={styles.title}>{title}</ThemedText>}
      <ThemedText style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</ThemedText>
    </View>
  );
}
