import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
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

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

function impactLines(preview: RestaurantDeletePreview): { icon: IconName; text: string }[] {
  const lines: { icon: IconName; text: string }[] = [
    { icon: "grid-outline", text: plural(preview.sectionCount, "section") },
    { icon: "restaurant-outline", text: plural(preview.tableCount, "table") },
  ];
  if (preview.tableGroupCount > 0) {
    lines.push({ icon: "link-outline", text: plural(preview.tableGroupCount, "combinable group") });
  }
  lines.push({
    icon: "calendar-outline",
    text:
      preview.upcomingBookingCount > 0
        ? `${plural(preview.bookingCount, "booking")}, ${preview.upcomingBookingCount} still upcoming`
        : plural(preview.bookingCount, "booking"),
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
  const { colors } = useAppTheme();
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    if (visible) setTypedName("");
  }, [visible]);

  // Case-insensitive: the friction that makes this deliberate is typing the whole name,
  // not reproducing its capitalisation on a tablet keyboard.
  const nameMatches = typedName.trim().toLowerCase() === name.trim().toLowerCase();
  const dangerSurface = `${colors.error}14`;

  return (
    <ModalCard
      visible={visible}
      title={`Delete ${name}?`}
      onDismiss={onCancel}
      alert
      dismissLabel="Cancel deletion"
      testID="delete-location-modal"
    >
      <ThemedText style={[styles.lead, { color: colors.muted }]}>
        This permanently destroys the location and everything attached to it. It cannot be undone.
      </ThemedText>

      <View style={[styles.impact, { borderColor: colors.border, backgroundColor: dangerSurface }]}>
        {loadingPreview ? (
          <ActivityIndicator
            size="small"
            color={colors.error}
            accessibilityLabel="Loading impact"
          />
        ) : preview ? (
          impactLines(preview).map((line) => (
            <View key={line.text} style={styles.impactRow}>
              <Icon name={line.icon} size="sm" color={colors.error} />
              <ThemedText style={styles.impactText}>{line.text}</ThemedText>
            </View>
          ))
        ) : (
          <ThemedText style={[styles.impactEmpty, { color: colors.muted }]}>
            Could not load what this would delete. The deletion below still removes every section,
            table and booking.
          </ThemedText>
        )}
      </View>

      <ThemedText style={[styles.confirmLabel, { color: colors.muted }]}>
        Type {name} to confirm
      </ThemedText>
      <Input
        value={typedName}
        onChangeText={setTypedName}
        placeholder={name}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={`Type ${name} to confirm deletion`}
        testID="delete-location-name-input"
      />

      {failed && (
        <ThemedText style={[styles.error, { color: colors.error }]}>
          Failed to delete. Please try again.
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
          accessibilityLabel="Cancel deletion"
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          size="md"
          style={styles.action}
          onPress={onConfirm}
          disabled={!nameMatches || deleting}
          loading={deleting}
          accessibilityLabel={`Permanently delete ${name}`}
        >
          {deleting ? "Deleting…" : "Delete permanently"}
        </Button>
      </View>
    </ModalCard>
  );
}

export default DeleteLocationModal;
