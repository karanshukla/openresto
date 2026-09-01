import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { useOnline } from "@/hooks/use-online";
import { styles } from "./OfflineBanner.styles";

/**
 * A slim strip above the guest surface while the device reports no connection. It carries no
 * control: there is nothing to retry from here, and the pages underneath already own their own
 * retry. It takes the top safe-area inset itself, since off web it sits above the navigator's
 * header and would otherwise run under the status bar.
 *
 * Rendered on web too — a browser that reports itself offline is offline — which is the one
 * deliberate addition to the web surface, and it is invisible while the browser reports online.
 *
 * @see [OfflineBanner.test.tsx](../../tests/components/layout/OfflineBanner.test.tsx) — pins
 * that it renders nothing while online and the offline wording while offline.
 */
export default function OfflineBanner() {
  const online = useOnline();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  if (online) return null;

  return (
    <View
      testID="offline-banner"
      role="status"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t("common.offline.label")}
      style={[
        styles.banner,
        { backgroundColor: colors.surfaceAlt, paddingTop: insets.top + theme.spacing.sm },
      ]}
    >
      <Icon name="cloud-offline-outline" size="sm" color={colors.muted} />
      <ThemedText style={[styles.text, { color: colors.muted }]}>
        {t("common.offline.message")}
      </ThemedText>
    </View>
  );
}
