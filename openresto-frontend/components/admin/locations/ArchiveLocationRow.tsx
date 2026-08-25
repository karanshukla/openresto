import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ConfirmModal from "@/components/common/ConfirmModal";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ArchiveLocationRow.styles";

export interface ArchiveLocationRowProps {
  name: string;
  /** Non-cancelled bookings that have not happened yet — named in the confirmation. */
  upcomingBookingsCount: number;
  archiving: boolean;
  failed: boolean;
  onArchive: () => void;
}

function archiveMessage(name: string, upcoming: number, t: TFunction): string {
  if (upcoming > 0) {
    return t("admin.locations.archiveRow.confirmMessageWithBookings", { name, count: upcoming });
  }
  return t("admin.locations.archiveRow.confirmMessageNoBookings", { name });
}

/**
 * Archive lives at the foot of the selected location's card rather than in a separate panel
 * with its own picker, so the location you are editing is the location you are archiving.
 */
export function ArchiveLocationRow({
  name,
  upcomingBookingsCount,
  archiving,
  failed,
  onArchive,
}: ArchiveLocationRowProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: `${colors.warning}1f` }]}>
        <Icon name="archive-outline" size="xl" color={colors.warning} />
      </View>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>{t("admin.locations.archiveRow.title")}</ThemedText>
        <ThemedText style={[styles.sub, { color: colors.muted }]}>
          {t("admin.locations.archiveRow.subtitle", { name })}
        </ThemedText>
        {failed && (
          <ThemedText style={[styles.error, { color: colors.warning }]}>
            {t("admin.locations.archiveRow.failed")}
          </ThemedText>
        )}
      </View>
      <Button
        variant="secondary"
        tone="warning"
        size="md"
        icon="archive-outline"
        disabled={archiving}
        loading={archiving}
        onPress={() => setConfirming(true)}
        accessibilityLabel={t("admin.locations.archiveRow.archiveLabel", { name })}
      >
        {archiving
          ? t("admin.locations.archiveRow.archiving")
          : t("admin.locations.archiveRow.archiveButton")}
      </Button>

      <ConfirmModal
        visible={confirming}
        title={t("admin.locations.archiveRow.confirmTitle", { name })}
        message={archiveMessage(name, upcomingBookingsCount, t)}
        confirmLabel={t("admin.locations.archiveRow.confirmYes")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onArchive();
        }}
      />
    </View>
  );
}

export default ArchiveLocationRow;
