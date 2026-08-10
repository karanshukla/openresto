import { useEffect, useRef } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

export interface ModalCardProps {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: React.ReactNode;
  /** Announce urgently (errors, confirmations) rather than as a plain dialog. */
  alert?: boolean;
  /** Label for the invisible backdrop-dismiss target. */
  dismissLabel?: string;
  testID?: string;
}

/**
 * Shared shell for the app's centred dialogs. Beyond the visuals it carries the dialog
 * semantics every modal needs and none of them had: a labelled dialog role, `aria-modal`
 * so assistive tech ignores the page behind it, and focus save/restore on web — without
 * which dismissing a dialog dumps keyboard focus back to the top of the document.
 */
export function ModalCard({
  visible,
  title,
  onDismiss,
  children,
  alert = false,
  dismissLabel = "Dismiss",
  testID,
}: ModalCardProps) {
  const { colors } = useAppTheme();
  const cardRef = useRef<View>(null);

  useEffect(() => {
    /* istanbul ignore next -- native has no document to restore focus within */
    if (Platform.OS !== "web" || !visible) return;
    const previous = (globalThis as { document?: Document }).document
      ?.activeElement as HTMLElement | null;
    (cardRef.current as unknown as HTMLElement | null)?.focus?.();
    return () => previous?.focus?.();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop} testID={testID}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
        />
        <View
          ref={cardRef}
          role={alert ? "alertdialog" : "dialog"}
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel={title}
          tabIndex={-1}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText type="h3" accessibilityRole="header">
            {title}
          </ThemedText>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  card: {
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    width: "100%",
    maxWidth: 400,
    gap: theme.spacing.md,
    ...theme.shadows.popup,
  },
});

export default ModalCard;
