import { ActivityIndicator, Pressable } from "react-native";
import { ThemedText } from "../themed-text";
import { ThemedView } from "../themed-view";
import { HoldStatus } from "./useTableHold";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./HoldStatusBanner.styles";

interface HoldStatusBannerProps {
  holdStatus: HoldStatus;
  secondsLeft: number;
  hasSelection: boolean;
  /** Specific rejection reason from the backend (e.g. past time, closed). Falls back to a generic line when absent. */
  holdMessage?: string | null;
  onRefresh?: () => void;
}

export default function HoldStatusBanner({
  holdStatus,
  secondsLeft,
  hasSelection,
  holdMessage,
  onRefresh,
}: HoldStatusBannerProps) {
  const { colors, isDark } = useAppTheme();

  if (!hasSelection) {
    return null;
  }

  switch (holdStatus) {
    case "pending":
      return (
        <ThemedView style={styles.holdRow} role="status" accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" accessibilityLabel="Checking availability" />
          <ThemedText style={styles.holdPending}>Checking availability…</ThemedText>
        </ThemedView>
      );
    case "held": {
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      return (
        <ThemedView style={styles.holdRow}>
          {/* The ticking countdown lives outside the live region so it isn't re-announced every second. */}
          <ThemedText
            style={[styles.holdHeld, { color: colors.success }]}
            role="status"
            accessibilityLiveRegion="polite"
          >
            ✓ Table held
          </ThemedText>
          <ThemedText style={[styles.holdHeld, { color: colors.success }]}>
            {" "}
            - expires in {mins}:{secs.toString().padStart(2, "0")}
          </ThemedText>
        </ThemedView>
      );
    }
    case "unavailable":
      return (
        <ThemedView style={styles.holdRow} role="alert" accessibilityLiveRegion="assertive">
          <ThemedText style={[styles.holdUnavailable, { color: colors.error }]}>
            ✗ {holdMessage ?? "Table not available for this date. Please choose another."}
          </ThemedText>
        </ThemedView>
      );
    case "expired":
      return (
        <ThemedView style={styles.expiredBox} role="alert" accessibilityLiveRegion="assertive">
          <ThemedText style={[styles.holdUnavailable, { color: colors.error }]}>
            Your table hold expired. Availability may have changed.
          </ThemedText>
          {onRefresh && (
            <Pressable
              onPress={onRefresh}
              accessibilityRole="button"
              accessibilityLabel="Refresh page"
              accessibilityHint="Reloads availability for this date"
              style={[
                styles.refreshBtn,
                { backgroundColor: isDark ? "rgba(220,38,38,0.15)" : "rgba(220,38,38,0.1)" },
              ]}
            >
              <ThemedText style={[styles.refreshBtnText, { color: colors.error }]}>
                Refresh page
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      );
    default:
      return null;
  }
}
