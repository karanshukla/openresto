import { useState } from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  adminDeleteRestaurant,
  adminGetRestaurantDeletePreview,
  type RestaurantDeletePreview,
} from "@/api/admin";
import { DeleteLocationModal } from "./DeleteLocationModal";
import { styles } from "./ArchivedLocationPanel.styles";

export interface ArchivedLocationPanelProps {
  id: number;
  name: string;
  restoring: boolean;
  restoreFailed: boolean;
  onRestore: () => void;
  /** Owner-only capability — permanent deletion is gated the same way server-side. */
  canDelete: boolean;
  onDeleted: (id: number) => void;
}

/**
 * What an archived location shows in place of its editable card. Archived rows are absent from
 * the editable list the screen loads, so this is a read-only stand-in whose point is Restore —
 * the reversible action, offered without a gate. Delete is the second, deliberate act, and only
 * reachable from here because the server refuses to delete a location that was never archived.
 */
export function ArchivedLocationPanel({
  id,
  name,
  restoring,
  restoreFailed,
  onRestore,
  canDelete,
  onDeleted,
}: ArchivedLocationPanelProps) {
  const { colors } = useAppTheme();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [preview, setPreview] = useState<RestaurantDeletePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const openDelete = async () => {
    setDeleteOpen(true);
    setDeleteFailed(false);
    setPreview(null);
    setLoadingPreview(true);
    setPreview(await adminGetRestaurantDeletePreview(id));
    setLoadingPreview(false);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteFailed(false);
    const ok = await adminDeleteRestaurant(id);
    setDeleting(false);
    if (!ok) {
      setDeleteFailed(true);
      return;
    }
    setDeleteOpen(false);
    onDeleted(id);
  };

  return (
    <>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${colors.muted}1f` }]}>
          <Icon name="archive-outline" size="xl" color={colors.muted} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <ThemedText style={styles.title}>{name}</ThemedText>
            <View style={[styles.badge, { borderColor: colors.border }]}>
              <ThemedText style={[styles.badgeText, { color: colors.muted }]}>Archived</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.sub, { color: colors.muted }]}>
            Hidden from the public site and not bookable. Its sections, tables and bookings are all
            still here. Restore it to edit it again.
          </ThemedText>
          {restoreFailed && (
            <ThemedText style={[styles.error, { color: colors.warning }]}>
              Failed to restore. Please try again.
            </ThemedText>
          )}
        </View>
        <Button
          variant="secondary"
          tone="success"
          size="md"
          icon="refresh-outline"
          disabled={restoring}
          loading={restoring}
          onPress={onRestore}
          accessibilityLabel={`Restore ${name}`}
        >
          {restoring ? "Restoring…" : "Restore"}
        </Button>
      </View>

      {canDelete && (
        <View style={[styles.row, { borderTopColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: `${colors.error}1a` }]}>
            <Icon name="trash-outline" size="xl" color={colors.error} />
          </View>
          <View style={styles.copy}>
            <ThemedText style={styles.rowTitle}>Delete this location</ThemedText>
            <ThemedText style={[styles.rowSub, { color: colors.muted }]}>
              Destroys {name} along with every section, table and booking. This cannot be undone.
            </ThemedText>
          </View>
          <Button
            variant="secondary"
            tone="danger"
            size="md"
            icon="trash-outline"
            onPress={openDelete}
            accessibilityLabel={`Permanently delete ${name}`}
            accessibilityHint="Opens a confirmation that asks you to type the location name"
          >
            Delete…
          </Button>
        </View>
      )}

      <DeleteLocationModal
        visible={deleteOpen}
        name={name}
        preview={preview}
        loadingPreview={loadingPreview}
        deleting={deleting}
        failed={deleteFailed}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

export default ArchivedLocationPanel;
