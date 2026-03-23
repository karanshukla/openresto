import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "../themed-text";
import { ThemedView } from "../themed-view";
import { HoldStatus } from "./useTableHold";

interface HoldStatusBannerProps {
  holdStatus: HoldStatus;
  secondsLeft: number;
  hasSelection: boolean;
  onRefresh?: () => void;
}

export default function HoldStatusBanner({
  holdStatus,
  secondsLeft,
  hasSelection,
  onRefresh,
}: HoldStatusBannerProps) {
  if (!hasSelection) {
    return null;
  }

  switch (holdStatus) {
    case "pending":
      return (
        <ThemedView style={styles.holdRow}>
          <ActivityIndicator size="small" />
          <ThemedText style={styles.holdPending}>Checking availability…</ThemedText>
        </ThemedView>
      );
    case "held": {
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      return (
        <ThemedView style={styles.holdRow}>
          <ThemedText style={styles.holdHeld}>
            ✓ Table held — expires in {mins}:{secs.toString().padStart(2, "0")}
          </ThemedText>
        </ThemedView>
      );
    }
    case "unavailable":
      return (
        <ThemedView style={styles.holdRow}>
          <ThemedText style={styles.holdUnavailable}>
            ✗ Table not available for this date. Please choose another.
          </ThemedText>
        </ThemedView>
      );
    case "expired":
      return (
        <ThemedView style={styles.expiredBox}>
          <ThemedText style={styles.holdUnavailable}>
            Your table hold expired. Availability may have changed.
          </ThemedText>
          {onRefresh && (
            <Pressable onPress={onRefresh} style={styles.refreshBtn}>
              <ThemedText style={styles.refreshBtnText}>Refresh page</ThemedText>
            </Pressable>
          )}
        </ThemedView>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  holdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  holdPending: {
    opacity: 0.6,
    fontSize: 13,
  },
  holdHeld: {
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "600",
  },
  holdUnavailable: {
    color: "#e53e3e",
    fontSize: 13,
  },
  expiredBox: {
    gap: 8,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  refreshBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: "rgba(229,62,62,0.12)",
  },
  refreshBtnText: {
    color: "#e53e3e",
    fontSize: 13,
    fontWeight: "600",
  },
});
