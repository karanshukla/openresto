import { useState } from "react";
import { View } from "react-native";
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

function archiveMessage(name: string, upcoming: number): string {
  const base = `${name} comes off the public site — customers can no longer find or book it.`;
  const bookings =
    upcoming > 0
      ? ` Its ${upcoming} upcoming booking${upcoming === 1 ? "" : "s"} stay intact in the admin, but the guests can no longer look them up on the site.`
      : " Existing bookings stay intact.";
  return `${base}${bookings} You can restore it at any time.`;
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
  const { colors } = useAppTheme();
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: `${colors.warning}1f` }]}>
        <Icon name="archive-outline" size="xl" color={colors.warning} />
      </View>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>Archive location</ThemedText>
        <ThemedText style={[styles.sub, { color: colors.muted }]}>
          Takes {name} off the public site. All data is kept and you can restore it at any time.
        </ThemedText>
        {failed && (
          <ThemedText style={[styles.error, { color: colors.warning }]}>
            Failed to archive. Please try again.
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
        accessibilityLabel={`Archive ${name}`}
      >
        {archiving ? "Archiving…" : "Archive"}
      </Button>

      <ConfirmModal
        visible={confirming}
        title={`Archive ${name}?`}
        message={archiveMessage(name, upcomingBookingsCount)}
        confirmLabel="Yes, archive"
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
