import { useRef } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { styles } from "./ModalCard.styles";

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
  dismissLabel,
  testID,
}: ModalCardProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const cardRef = useRef<View>(null);
  useDialogFocus(visible, cardRef);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop} testID={testID}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel ?? t("common.modalCard.defaultDismissLabel")}
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

export default ModalCard;
