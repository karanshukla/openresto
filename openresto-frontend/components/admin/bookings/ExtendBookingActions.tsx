import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { bookingDetailStyles as styles } from "./booking-detail.styles";
import { Icon } from "@/components/common/Icon";

interface ExtendBookingActionsProps {
  borderColor: string;
  mutedColor: string;
  extending: boolean;
  onExtend: (mins: number) => void;
}

export function ExtendBookingActions({
  borderColor,
  mutedColor,
  extending,
  onExtend,
}: ExtendBookingActionsProps) {
  const { primaryColor: PRIMARY } = useAppTheme();
  return (
    <View style={[styles.section, { borderColor }]}>
      <View style={styles.sectionHeader}>
        <Icon name="time-outline" size="md" color={mutedColor} />
        <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>Extend booking</ThemedText>
      </View>
      <View style={styles.extendBtns}>
        {[30, 60, 90].map((mins) => (
          <Pressable
            key={mins}
            style={(state) => [
              styles.extendBtn,
              { backgroundColor: PRIMARY },
              (state as { hovered?: boolean }).hovered && /* istanbul ignore next */ {
                opacity: 0.9,
              },
              extending && { opacity: 0.7 },
            ]}
            onPress={() => onExtend(mins)}
            disabled={extending}
            accessibilityRole="button"
            accessibilityLabel={`Extend booking by ${mins} minutes`}
            accessibilityState={{ disabled: extending, busy: extending }}
          >
            <ThemedText style={styles.extendBtnText}>+{mins} min</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
