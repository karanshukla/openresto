import { Modal, Pressable, View, TouchableWithoutFeedback } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { SHORTCUTS_BY_SCOPE, ShortcutScope } from "@/constants/keyboardShortcuts";
import { styles } from "./KeyboardShortcutsHelp.styles";

interface KeyboardShortcutsHelpProps {
  visible: boolean;
  scope: ShortcutScope;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({
  visible,
  scope,
  onClose,
}: KeyboardShortcutsHelpProps) {
  const { colors } = useAppTheme();
  const shortcuts = SHORTCUTS_BY_SCOPE[scope];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID="keyboard-shortcuts-backdrop"
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close keyboard shortcuts"
      >
        <TouchableWithoutFeedback>
          <View
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel="Keyboard shortcuts"
          >
            <ThemedText type="h3" accessibilityRole="header">
              Keyboard shortcuts
            </ThemedText>
            <View style={styles.list}>
              {shortcuts.map((s) => (
                <View key={s.keys} style={styles.row}>
                  <View
                    style={[
                      styles.keyBadge,
                      { borderColor: colors.border, backgroundColor: colors.input },
                    ]}
                  >
                    <ThemedText style={styles.keyText}>{s.keys}</ThemedText>
                  </View>
                  <ThemedText style={[styles.description, { color: colors.muted }]}>
                    {s.description}
                  </ThemedText>
                </View>
              ))}
            </View>
            <Pressable
              testID="keyboard-shortcuts-close"
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeBtn, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <ThemedText style={[styles.closeBtnText, { color: colors.muted }]}>Close</ThemedText>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </Pressable>
    </Modal>
  );
}
