import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
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
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  return (
    <Pressable
      style={(state) => [
        styles.globalRow,
        { borderColor, backgroundColor: cardBg },
        !comingSoon && (state as { hovered?: boolean }).hovered && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.globalRowIcon, { backgroundColor: `${primaryColor}14` }]}>
        <Ionicons name={icon} size={18} color={primaryColor} />
      </View>
      <View style={styles.globalRowText}>
        <ThemedText style={styles.globalRowTitle}>{title}</ThemedText>
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
