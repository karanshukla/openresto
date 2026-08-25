import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { Icon, type IconName } from "@/components/common/Icon";
import { ModalCard } from "@/components/common/ModalCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { RestaurantDeletePreview } from "@/api/admin";
import { styles } from "./DeleteLocationModal.styles";

export interface DeleteLocationModalProps {
  visible: boolean;
  name: string;
  /** Blast-radius counts; null while the preflight is in flight or after it failed. */
  preview: RestaurantDeletePreview | null;
  loadingPreview: boolean;
  deleting: boolean;
  failed: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function impactLines(
  preview: RestaurantDeletePreview,
  t: TFunction
): { icon: IconName; text: string }[] {
  const lines: { icon: IconName; text: string }[] = [
    {
      icon: "grid-outline",
      text: t("admin.locations.deleteModal.impact.sections", { count: preview.sectionCount }),
    },
    {
      icon: "restaurant-outline",
      text: t("admin.locations.deleteModal.impact.tables", { count: preview.tableCount }),
    },
  ];
  if (preview.tableGroupCount > 0) {
    lines.push({
      icon: "link-outline",
      text: t("admin.locations.deleteModal.impact.combinableGroups", {
        count: preview.tableGroupCount,
      }),
    });
  }
  lines.push({
    icon: "calendar-outline",
    text:
      preview.upcomingBookingCount > 0
        ? t("admin.locations.deleteModal.impact.bookingsWithUpcoming", {
            count: preview.bookingCount,
            upcoming: preview.upcomingBookingCount,
          })
        : t("admin.locations.deleteModal.impact.bookings", { count: preview.bookingCount }),
  });
  return lines;
}

/**
 * The one irreversible cascade in the admin. Typing the location's name is the gate: the
 * counts above it come from a server preflight so the confirmation names what it destroys
 * rather than describing it in the abstract.
 */
export function DeleteLocationModal({
  visible,
  name,
  preview,
  loadingPreview,
  deleting,
  failed,
  onCancel,
  onConfirm,
}: DeleteLocationModalProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    if (visible) setTypedName("");
  }, [visible]);

  // Case-insensitive: the friction that makes this deliberate is typing the whole name,
  // not reproducing its capitalisation on a tablet keyboard.
  const nameMatches = typedName.trim().toLowerCase() === name.trim().toLowerCase();
  const dangerSurface = `${colors.error}14`;
  const cancelDeletionLabel = t("admin.locations.deleteModal.cancelDeletionLabel");

  return (
    <ModalCard
      visible={visible}
      title={t("admin.locations.deleteModal.title", { name })}
      onDismiss={onCancel}
      alert
      dismissLabel={cancelDeletionLabel}
      testID="delete-location-modal"
    >
      <ThemedText style={[styles.lead, { color: colors.muted }]}>
        {t("admin.locations.deleteModal.lead")}
      </ThemedText>

      <View style={[styles.impact, { borderColor: colors.border, backgroundColor: dangerSurface }]}>
        {loadingPreview ? (
          <ActivityIndicator
            size="small"
            color={colors.error}
            accessibilityLabel={t("admin.locations.deleteModal.loadingImpact")}
          />
        ) : preview ? (
          impactLines(preview, t).map((line) => (
            <View key={line.text} style={styles.impactRow}>
              <Icon name={line.icon} size="sm" color={colors.error} />
              <ThemedText style={styles.impactText}>{line.text}</ThemedText>
            </View>
          ))
        ) : (
          <ThemedText style={[styles.impactEmpty, { color: colors.muted }]}>
            {t("admin.locations.deleteModal.impactUnavailable")}
          </ThemedText>
        )}
      </View>

      <ThemedText style={[styles.confirmLabel, { color: colors.muted }]}>
        {t("admin.locations.deleteModal.typeToConfirm", { name })}
      </ThemedText>
      <Input
        value={typedName}
        onChangeText={setTypedName}
        placeholder={name}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={t("admin.locations.deleteModal.typeToConfirmA11y", { name })}
        testID="delete-location-name-input"
      />

      {failed && (
        <ThemedText style={[styles.error, { color: colors.error }]}>
          {t("admin.locations.deleteModal.failed")}
        </ThemedText>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Button
          variant="secondary"
          tone="neutral"
          size="md"
          style={styles.action}
          onPress={onCancel}
          disabled={deleting}
          accessibilityLabel={cancelDeletionLabel}
        >
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="danger"
          size="md"
          style={styles.action}
          onPress={onConfirm}
          disabled={!nameMatches || deleting}
          loading={deleting}
          accessibilityLabel={t("admin.locations.permanentlyDeleteLabel", { name })}
        >
          {deleting
            ? t("admin.locations.deleteModal.deleting")
            : t("admin.locations.deleteModal.deletePermanently")}
        </Button>
      </View>
    </ModalCard>
  );
}

export default DeleteLocationModal;
