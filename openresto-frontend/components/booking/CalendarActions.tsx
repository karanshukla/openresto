import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";
import { buildCalendarUrls } from "@/utils/calendar";

interface CalendarActionsProps {
  bookingRef: string;
  date: string;
  seats: number;
  specialRequests?: string;
  restaurantName: string;
  restaurantAddress: string;
  variant?: "compact" | "full";
}

export default function CalendarActions(props: CalendarActionsProps) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const { googleUrl, outlookUrl, downloadIcs } = buildCalendarUrls(props);

  if (props.variant === "compact") {
    return (
      <View
        style={[
          styles.compactWrap,
          { backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" },
        ]}
      >
        <ThemedText style={[styles.sectionTitle, { color: colors.muted }]}>
          ADD TO CALENDAR
        </ThemedText>
        <View style={styles.compactRow}>
          <CalBtn
            label="Google"
            icon="logo-google"
            color="#4285F4"
            isDark={isDark}
            onPress={() => window.open(googleUrl, "_blank")}
          />
          <CalBtn
            label="Outlook"
            icon="calendar-outline"
            color="#0078D4"
            isDark={isDark}
            onPress={() => window.open(outlookUrl, "_blank")}
          />
          <CalBtn
            label=".ics"
            icon="download-outline"
            color={colors.muted}
            isDark={isDark}
            onPress={downloadIcs}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullWrap}>
      <ThemedText style={[styles.sectionTitle, { color: colors.muted }]}>
        ADD TO CALENDAR
      </ThemedText>
      <FullCalBtn
        label="Google Calendar"
        sub="Opens in a new tab"
        icon="logo-google"
        color="#4285F4"
        isDark={isDark}
        onPress={() => window.open(googleUrl, "_blank")}
        trailingIcon="open-outline"
        mutedColor={colors.muted}
      />
      <FullCalBtn
        label="Outlook Calendar"
        sub="Opens in a new tab"
        icon="calendar-outline"
        color="#0078D4"
        isDark={isDark}
        onPress={() => window.open(outlookUrl, "_blank")}
        trailingIcon="open-outline"
        mutedColor={colors.muted}
      />
      <FullCalBtn
        label="Download .ics"
        sub="Apple Calendar, Thunderbird, etc."
        icon="download-outline"
        isDark={isDark}
        onPress={downloadIcs}
        trailingIcon="chevron-forward"
        mutedColor={colors.muted}
      />
    </View>
  );
}

function CalBtn({
  label,
  icon,
  color,
  isDark,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.compactBtn, { backgroundColor: isDark ? `${color}19` : `${color}0F` }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={16} color={color} />
      <ThemedText style={[styles.compactBtnText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

function FullCalBtn({
  label,
  sub,
  icon,
  color,
  isDark,
  onPress,
  trailingIcon,
  mutedColor,
}: {
  label: string;
  sub: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color?: string;
  isDark: boolean;
  onPress: () => void;
  trailingIcon: React.ComponentProps<typeof Ionicons>["name"];
  mutedColor: string;
}) {
  const textColor = color || mutedColor;
  return (
    <Pressable
      style={[styles.fullBtn, { backgroundColor: isDark ? `${textColor}1F` : `${textColor}0F` }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={textColor} />
      <View style={styles.fullBtnContent}>
        <ThemedText style={[styles.fullBtnText, color ? { color } : undefined]}>{label}</ThemedText>
        <ThemedText style={[styles.fullBtnSub, { color: mutedColor }]}>{sub}</ThemedText>
      </View>
      <Ionicons name={trailingIcon} size={14} color={mutedColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactWrap: { padding: 16, borderRadius: 10, gap: 10 },
  compactRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  compactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    minWidth: 70,
    maxWidth: 100,
    justifyContent: "center",
  },
  compactBtnText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  fullWrap: { gap: 10 },
  fullBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  fullBtnContent: { flex: 1, gap: 1 },
  fullBtnText: { fontSize: 14, fontWeight: "600" },
  fullBtnSub: { fontSize: 11 },
});
