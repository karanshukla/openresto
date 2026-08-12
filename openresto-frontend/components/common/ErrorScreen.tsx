import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ErrorScreen.styles";

interface ErrorScreenProps {
  /** Defaults to "Something went wrong". */
  title?: string;
  /** Defaults to "An unexpected error occurred. Try again.". */
  message?: string;
  /** When provided, a "Try again" action is shown that calls this. */
  retry?: () => void;
  /** When provided, a "Go to home" action is shown that calls this. */
  onGoHome?: () => void;
}

/**
 * Used by the root error.tsx boundary. The retry/onGoHome props
 * are optional so the same component can serve boundaries that have no
 * navigation context.
 */
export default function ErrorScreen({
  title = "Something went wrong",
  message = "An unexpected error occurred. Try again.",
  retry,
  onGoHome,
}: ErrorScreenProps) {
  const { colors, primaryColor, isDark } = useAppTheme();
  const mutedColor = isDark ? colors.muted : "#666";

  return (
    <ThemedView style={styles.root}>
      <View style={styles.content}>
        <View style={[styles.iconRing, { borderColor: colors.border }]}>
          <Ionicons name="warning-outline" size={32} color={mutedColor} />
        </View>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText style={[styles.message, { color: mutedColor }]}>{message}</ThemedText>
        {(retry || onGoHome) && (
          <View style={styles.actions}>
            {retry && (
              <Pressable
                style={[styles.btn, { backgroundColor: primaryColor }]}
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Try again"
              >
                <ThemedText style={styles.btnText}>Try again</ThemedText>
              </Pressable>
            )}
            {onGoHome && (
              <Pressable
                style={[styles.btnOutline, { borderColor: primaryColor }]}
                onPress={onGoHome}
                accessibilityRole="button"
                accessibilityLabel="Go to home"
              >
                <ThemedText style={[styles.btnOutlineText, { color: primaryColor }]}>
                  Go to home
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ThemedView>
  );
}
