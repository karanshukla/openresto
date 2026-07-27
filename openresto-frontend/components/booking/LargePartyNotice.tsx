import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * Inline bubble shown in the booking form when the selected party size exceeds
 * the largest single table at the location. Mirrors the WalkInNotice card
 * treatment (soft brand tint + icon badge + title/body) and exposes a "Contact
 * us" affordance that opens the large-party modal. Table merging isn't
 * supported yet, so this routes bigger groups to the restaurant directly.
 */
export default function LargePartyNotice({
  maxCapacity,
  onContact,
}: {
  maxCapacity: number;
  onContact: () => void;
}) {
  const { colors, primaryColor } = useAppTheme();

  // Tint the brand color for a soft fill + border, matching WalkInNotice.
  const accentHex = primaryColor.replace("#", "");
  const r = parseInt(accentHex.slice(0, 2), 16);
  const g = parseInt(accentHex.slice(2, 4), 16);
  const b = parseInt(accentHex.slice(4, 6), 16);
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
        <Ionicons name="people-outline" size={20} color="#fff" />
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

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
  },
  contactLink: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
});
