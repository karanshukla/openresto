import { Modal, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={[styles.message, { color: colors.muted }]}>{message}</ThemedText>
          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]} onPress={onCancel}>
              <ThemedText style={[styles.btnText, { color: colors.muted }]}>{cancelLabel}</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.confirmBtn,
                { backgroundColor: destructive ? COLORS.error : COLORS.primary },
              ]}
              onPress={onConfirm}
            >
              <ThemedText style={styles.confirmBtnText}>{confirmLabel}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  btn: {
    flex: 1,
    ...BUTTON_SIZES.secondary,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelBtn: {
    borderWidth: 1,
  },
  confirmBtn: {},
  btnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  confirmBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
