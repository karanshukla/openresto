import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  TouchableWithoutFeedback,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  COLORS,
  BUTTON_SIZES,
  BORDER_RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  getThemeColors,
} from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";

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
  const brand = useBrand();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <TouchableWithoutFeedback>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText type="h3">{title}</ThemedText>
            <ThemedText style={[styles.message, { color: colors.muted }]}>{message}</ThemedText>
            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Pressable
                style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onCancel();
                }}
              >
                <ThemedText style={[styles.btnText, { color: colors.muted }]}>
                  {cancelLabel}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.btn,
                  {
                    backgroundColor: destructive
                      ? COLORS.error
                      : brand.primaryColor || COLORS.primary,
                  },
                ]}
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.notificationAsync(
                      destructive
                        ? Haptics.NotificationFeedbackType.Warning
                        : Haptics.NotificationFeedbackType.Success
                    );
                  }
                  onConfirm();
                }}
              >
                <ThemedText style={styles.confirmBtnText}>{confirmLabel}</ThemedText>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
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
    padding: SPACING.xxl,
  },
  card: {
    borderRadius: BORDER_RADIUS.modal,
    borderWidth: 1,
    padding: SPACING.xxl,
    width: "100%",
    maxWidth: 400,
    gap: SPACING.md,
    ...SHADOWS.popup,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.xsm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
  },
  btn: {
    flex: 1,
    ...BUTTON_SIZES.secondary,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: "center",
  },
  cancelBtn: {
    borderWidth: 1,
  },
  btnText: {
    ...TYPOGRAPHY.bodyBold,
  },
  confirmBtnText: {
    color: COLORS.white,
    ...TYPOGRAPHY.bodyBold,
    fontWeight: "700",
  },
});
