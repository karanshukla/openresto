import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./UpdateRequired.styles";

/**
 * What a native build renders instead of the navigator once the server's
 * `minimumAppVersion` has moved past it. There is deliberately no dismiss and no store link:
 * the store the build came from is the publisher's, not upstream's, so the screen states the
 * situation and leaves the update to the platform's own store app.
 *
 * @see [UpdateRequired.test.tsx](../../tests/components/common/UpdateRequired.test.tsx) — pins
 * that it names the brand and carries the update instruction.
 */
export default function UpdateRequired() {
  const { t } = useTranslation();
  const { brand, colors, primaryColor } = useAppTheme();

  return (
    <ThemedView style={styles.root} testID="update-required">
      <Icon name="cloud-download-outline" size={44} color={primaryColor} />
      <ThemedText style={[styles.brand, { color: primaryColor }]}>{brand.appName}</ThemedText>
      <ThemedText style={styles.title} accessibilityRole="header">
        {t("common.updateRequired.title")}
      </ThemedText>
      <ThemedText style={[styles.message, { color: colors.muted }]}>
        {t("common.updateRequired.message")}
      </ThemedText>
    </ThemedView>
  );
}
