import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgb } from "@/utils/colors";
import { styles } from "./LargePartyNotice.styles";
import { Icon } from "@/components/common/Icon";

/**
 * Inline bubble shown in the booking form when the selected party size exceeds the
 * location's largest bookable capacity; "Contact us" opens the large-party modal.
 */
export default function LargePartyNotice({
  maxCapacity,
  onContact,
}: {
  maxCapacity: number;
  onContact: () => void;
}) {
  const { colors, primaryColor } = useAppTheme();

  const { r, g, b } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${r},${g},${b},0.10)`;
  const accentBorder = `rgba(${r},${g},${b},0.28)`;

  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.card,
        { backgroundColor: accentSoft, borderColor: accentBorder },
        hovered && { opacity: 0.85 },
      ]}
      onPress={onContact}
      accessibilityRole="button"
      accessibilityLabel="Contact us about a large party"
    >
      <View style={[styles.iconWrap, { backgroundColor: primaryColor }]}>
        <Icon name="people-outline" size="xl" color="#fff" />
      </View>
      <View style={styles.textWrap}>
        <ThemedText style={[styles.title, { color: colors.text }]}>Large party</ThemedText>
        <ThemedText style={[styles.body, { color: colors.muted }]}>
          Our largest table seats {maxCapacity}. Get in touch to arrange a booking for a bigger
          group.
        </ThemedText>
        <ThemedText style={[styles.contactLink, { color: primaryColor }]}>Contact us →</ThemedText>
      </View>
    </Pressable>
  );
}
