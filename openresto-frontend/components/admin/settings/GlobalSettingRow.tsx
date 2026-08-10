import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./settings.styles";

export function GlobalSettingRow({
  icon,
  title,
  sub,
  mutedColor,
  borderColor,
  cardBg,
  comingSoon,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  sub: string;
  mutedColor: string;
  borderColor: string;
  cardBg: string;
  comingSoon?: boolean;
}) {
  const { primaryColor } = useAppTheme();

  return (
    // Carries no onPress — the row is a static description of a setting, so it announces as
    // content rather than as an unnamed button a screen-reader user could try to activate.
    <Pressable
      accessibilityRole="none"
      focusable={false}
      style={(state) => [
        styles.globalRow,
        { borderColor, backgroundColor: cardBg },
        !comingSoon &&
          (state as { hovered?: boolean }).hovered && /* istanbul ignore next */ { opacity: 0.85 },
      ]}
    >
      <View style={[styles.globalRowIcon, { backgroundColor: `${primaryColor}14` }]}>
        <Ionicons name={icon} size={18} color={primaryColor} />
      </View>
      <View style={styles.globalRowText}>
        <ThemedText style={styles.globalRowTitle}>
          {comingSoon ? `${title} (coming soon)` : title}
        </ThemedText>
        <ThemedText style={[styles.globalRowSub, { color: mutedColor }]}>{sub}</ThemedText>
      </View>
      {comingSoon ? (
        <View style={[styles.comingSoonBadge, { backgroundColor: `${primaryColor}14` }]}>
          <ThemedText style={[styles.comingSoonText, { color: primaryColor }]}>Soon</ThemedText>
        </View>
      ) : (
        <Ionicons name="chevron-forward-outline" size={16} color={mutedColor} />
      )}
    </Pressable>
  );
}
