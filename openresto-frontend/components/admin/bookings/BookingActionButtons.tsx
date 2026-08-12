import { Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";
import { bookingDetailStyles as styles } from "./booking-detail.styles";

interface BookingActionButtonsProps {
  isCancelled: boolean;
  isPast?: boolean;
  uncancelling: boolean;
  deleting: boolean;
  mutedColor: string;
  onUncancel: () => void;
  onCancel: () => void;
  onPurge: () => void;
}

export function BookingActionButtons({
  isCancelled,
  isPast,
  uncancelling,
  deleting,
  mutedColor,
  onUncancel,
  onCancel,
  onPurge,
}: BookingActionButtonsProps) {
  return (
    <>
      {isCancelled && (
        <Pressable
          style={[styles.uncancelBtn, uncancelling && { opacity: 0.6 }]}
          onPress={onUncancel}
          disabled={uncancelling}
          accessibilityRole="button"
          accessibilityLabel="Restore booking"
          accessibilityState={{ disabled: uncancelling, busy: uncancelling }}
        >
          <Ionicons name="refresh-outline" size={16} color={theme.colors.success} />
          <ThemedText style={styles.uncancelBtnText}>
            {uncancelling ? "Restoring…" : "Restore Booking"}
          </ThemedText>
        </Pressable>
      )}

      {!isCancelled && !isPast && (
        <Pressable
          style={[styles.cancelBtn, deleting && { opacity: 0.6 }]}
          onPress={onCancel}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Cancel booking"
          accessibilityState={{ disabled: deleting, busy: deleting }}
        >
          <Ionicons name="trash-outline" size={15} color={theme.colors.error} />
          <ThemedText style={styles.cancelBtnText}>
            {deleting ? "Cancelling…" : "Cancel Booking"}
          </ThemedText>
        </Pressable>
      )}

      <Pressable
        style={[
          styles.purgeBtn,
          { borderColor: "rgba(128,128,128,0.2)" },
          deleting && { opacity: 0.6 },
        ]}
        onPress={onPurge}
        disabled={deleting}
        accessibilityRole="button"
        accessibilityLabel="Permanently delete booking for GDPR"
        accessibilityHint="This cannot be undone"
        accessibilityState={{ disabled: deleting, busy: deleting }}
      >
        <Ionicons name="nuclear-outline" size={15} color={mutedColor} />
        <ThemedText style={[styles.purgeBtnText, { color: mutedColor }]}>
          Permanently Delete (GDPR)
        </ThemedText>
      </Pressable>
    </>
  );
}
