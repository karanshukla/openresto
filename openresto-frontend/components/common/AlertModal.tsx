import { Modal, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";

interface AlertModalProps {
  visible: boolean;
  title?: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
}

export default function AlertModal({
  visible,
  title = "Notice",
  message,
  buttonLabel = "OK",
  onClose,
}: AlertModalProps) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => {}}
        >
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={[styles.message, { color: colors.muted }]}>{message}</ThemedText>
          <Pressable style={[styles.btn, { backgroundColor: COLORS.primary }]} onPress={onClose}>
            <ThemedText style={styles.btnText}>{buttonLabel}</ThemedText>
          </Pressable>
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
  btn: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
