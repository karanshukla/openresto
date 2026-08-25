import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ErrorScreen.styles";
import { Icon } from "@/components/common/Icon";

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
export default function ErrorScreen({ title, message, retry, onGoHome }: ErrorScreenProps) {
  const { colors, primaryColor, isDark } = useAppTheme();
  const { t } = useTranslation();
  const mutedColor = isDark ? colors.muted : "#666";
  const resolvedTitle = title ?? t("errors.generic");
  const resolvedMessage = message ?? t("errors.genericMessage");

  return (
    <ThemedView style={styles.root}>
      <View style={styles.content}>
        <View style={[styles.iconRing, { borderColor: colors.border }]}>
          <Icon name="warning-outline" size={32} color={mutedColor} />
        </View>
        <ThemedText style={styles.title}>{resolvedTitle}</ThemedText>
        <ThemedText style={[styles.message, { color: mutedColor }]}>{resolvedMessage}</ThemedText>
        {(retry || onGoHome) && (
          <View style={styles.actions}>
            {retry && (
              <Pressable
                style={[styles.btn, { backgroundColor: primaryColor }]}
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel={t("common.actions.tryAgain")}
              >
                <ThemedText style={styles.btnText}>{t("common.actions.tryAgain")}</ThemedText>
              </Pressable>
            )}
            {onGoHome && (
              <Pressable
                style={[styles.btnOutline, { borderColor: primaryColor }]}
                onPress={onGoHome}
                accessibilityRole="button"
                accessibilityLabel={t("common.actions.goHome")}
              >
                <ThemedText style={[styles.btnOutlineText, { color: primaryColor }]}>
                  {t("common.actions.goHome")}
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </ThemedView>
  );
}
