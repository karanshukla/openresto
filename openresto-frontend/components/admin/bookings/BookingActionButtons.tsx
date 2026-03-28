import { Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { bookingDetailStyles as styles } from "./booking-detail.styles";

interface BookingActionButtonsProps {
  isCancelled: boolean;
  uncancelling: boolean;
  deleting: boolean;
  mutedColor: string;
  onUncancel: () => void;
  onCancel: () => void;
  onPurge: () => void;
}

export function BookingActionButtons({
  isCancelled,
  uncancelling,
  deleting,
  mutedColor,
  onUncancel,
  onCancel,
  onPurge,
}: BookingActionButtonsProps) {
  return (
    <>
      {/* Uncancel - only for cancelled bookings */}
      {isCancelled && (
        <Pressable
          style={[styles.uncancelBtn, uncancelling && { opacity: 0.6 }]}
          onPress={onUncancel}
          disabled={uncancelling}
        >
          <Ionicons name="refresh-outline" size={16} color={COLORS.success} />
          <ThemedText style={styles.uncancelBtnText}>
            {uncancelling ? "Restoring…" : "Restore Booking"}
          </ThemedText>
        </Pressable>
      )}

      {/* Cancel - hide if already cancelled */}
      {!isCancelled && (
        <Pressable
          style={[styles.cancelBtn, deleting && { opacity: 0.6 }]}
          onPress={onCancel}
          disabled={deleting}
        >
          <Ionicons name="trash-outline" size={15} color={COLORS.error} />
          <ThemedText style={styles.cancelBtnText}>
            {deleting ? "Cancelling…" : "Cancel Booking"}
          </ThemedText>
        </Pressable>
      )}

      {/* Permanent delete (GDPR) */}
      <Pressable
        style={[
          styles.purgeBtn,
          { borderColor: "rgba(128,128,128,0.2)" },
          deleting && { opacity: 0.6 },
        ]}
        onPress={onPurge}
        disabled={deleting}
      >
        <Ionicons name="nuclear-outline" size={15} color={mutedColor} />
        <ThemedText style={[styles.purgeBtnText, { color: mutedColor }]}>
          Permanently Delete (GDPR)
        </ThemedText>
      </Pressable>
    </>
  );
}
