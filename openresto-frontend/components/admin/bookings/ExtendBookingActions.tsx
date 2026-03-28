import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { bookingDetailStyles as styles } from "./booking-detail.styles";

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
  return (
    <View style={[styles.section, { borderColor }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name="time-outline" size={16} color={mutedColor} />
        <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>Extend booking</ThemedText>
      </View>
      <View style={styles.extendBtns}>
        {[30, 60, 90].map((mins) => (
          <Pressable
            key={mins}
            style={(state) => [
              styles.extendBtn,
              { backgroundColor: COLORS.primary },
              (state as { hovered?: boolean }).hovered && { opacity: 0.9 },
              extending && { opacity: 0.7 },
            ]}
            onPress={() => onExtend(mins)}
            disabled={extending}
          >
            <ThemedText style={styles.extendBtnText}>+{mins} min</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
