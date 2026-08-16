import { Pressable, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { buildCalendarUrls } from "@/utils/calendar";
import { styles } from "./CalendarActions.styles";

interface CalendarActionsProps {
  bookingRef: string;
  date: string;
  endTime?: string;
  seats: number;
  specialRequests?: string;
  restaurantName: string;
  restaurantAddress: string;
  sectionName?: string;
  tableName?: string;
  variant?: "compact" | "full";
}

export default function CalendarActions(props: CalendarActionsProps) {
  const { isDark, colors, primaryColor } = useAppTheme();
  const { googleUrl, outlookUrl, downloadIcs } = buildCalendarUrls(props);

  if (props.variant === "compact") {
    return (
      <View style={styles.compactWrap}>
        <ThemedText style={[styles.sectionTitle, { color: colors.muted }]}>
          ADD TO CALENDAR
        </ThemedText>
        <View style={styles.compactRow}>
          <CalBtn
            label="Google"
            icon="logo-google"
            color={primaryColor}
            isDark={isDark}
            onPress={/* istanbul ignore next */ () => window.open(googleUrl, "_blank")}
          />
          <CalBtn
            label="Outlook"
            icon="calendar-outline"
            color={primaryColor}
            isDark={isDark}
            onPress={/* istanbul ignore next */ () => window.open(outlookUrl, "_blank")}
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
        sub=""
        icon="logo-google"
        color={primaryColor}
        isDark={isDark}
        onPress={/* istanbul ignore next */ () => window.open(googleUrl, "_blank")}
        trailingIcon="open-outline"
        mutedColor={colors.muted}
      />
      <FullCalBtn
        label="Outlook Calendar"
        sub=""
        icon="calendar-outline"
        color={primaryColor}
        isDark={isDark}
        onPress={/* istanbul ignore next */ () => window.open(outlookUrl, "_blank")}
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
  icon: IconName;
  color: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.compactBtn, { backgroundColor: isDark ? `${color}19` : `${color}0F` }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size="md" color={color} />
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
  icon: IconName;
  color?: string;
  isDark: boolean;
  onPress: () => void;
  trailingIcon: IconName;
  mutedColor: string;
}) {
  const textColor = color || mutedColor;
  return (
    <Pressable
      style={[styles.fullBtn, { backgroundColor: isDark ? `${textColor}1F` : `${textColor}0F` }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
    >
      <Icon name={icon} size="lg" color={textColor} />
      <View style={styles.fullBtnContent}>
        <ThemedText style={[styles.fullBtnText, color ? { color } : undefined]}>{label}</ThemedText>
        {sub ? (
          <ThemedText style={[styles.fullBtnSub, { color: mutedColor }]}>{sub}</ThemedText>
        ) : null}
      </View>
      <Icon name={trailingIcon} size="sm" color={mutedColor} />
    </Pressable>
  );
}
