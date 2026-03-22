import { Modal, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";

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
  const cardBg = isDark ? "#25282c" : "#ffffff";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: cardBg, borderColor }]} onPress={() => {}}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={[styles.message, { color: mutedColor }]}>{message}</ThemedText>
          <View style={[styles.actions, { borderTopColor: borderColor }]}>
            <Pressable
              style={[styles.btn, styles.cancelBtn, { borderColor }]}
              onPress={onCancel}
            >
              <ThemedText style={[styles.btnText, { color: mutedColor }]}>{cancelLabel}</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.confirmBtn,
                { backgroundColor: destructive ? "#dc2626" : "#0a7ea4" },
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
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelBtn: {
    borderWidth: 1,
  },
  confirmBtn: {},
  btnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
