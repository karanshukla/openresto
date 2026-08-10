import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useState, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import * as Haptics from "expo-haptics";

export interface SelectOption {
  label: string;
  value: string | number;
}

export default function Select({
  options,
  onSelect,
  selectedValue,
  placeholder = "Select an option",
  icon,
  accessibilityLabel,
}: {
  options: SelectOption[];
  onSelect: (value: string | number) => void;
  selectedValue?: string | number;
  placeholder?: string;
  /** Optional leading glyph, for compact filter bars where the label alone is ambiguous. */
  icon?: ComponentProps<typeof Ionicons>["name"];
  accessibilityLabel?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors, isDark, primaryColor } = useAppTheme();
  const borderColor = colors.border;
  const placeholderColor = colors.muted;
  const backgroundColor = colors.input;
  const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const selectedOption = options.find((o) => o.value === selectedValue);

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          testID="select-backdrop"
          style={styles.backdrop}
          onPress={() => setModalVisible(false)}
        >
          <ThemedView style={[styles.modalView, { borderColor }]}>
            {/*
              Plain ScrollView over FlatList: option counts are small (max ~50 for seat pickers),
              so virtualization buys nothing, and react-native-web's FlatList scroll container
              intercepts the touch-start of a tap (treating it as a potential drag) so the option's
              onPress never fires — the modal just dismisses on pointer-up. A ScrollView with
              nestedScrollEnabled + direct Pressable rows is reliable cross-platform.
            */}
            <ScrollView style={styles.list} nestedScrollEnabled>
              {options.map((item, i) => (
                <View key={item.value.toString()}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.option,
                      item.value === selectedValue && { backgroundColor: `${primaryColor}14` },
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(item.value);
                      setModalVisible(false);
                    }}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        item.value === selectedValue && { color: primaryColor, fontWeight: "600" },
                      ]}
                    >
                      {item.label}
                    </ThemedText>
                    {item.value === selectedValue && (
                      <ThemedText style={[styles.checkmark, { color: primaryColor }]}>✓</ThemedText>
                    )}
                  </Pressable>
                  {i < options.length - 1 && (
                    <ThemedView style={[styles.separator, { backgroundColor: dividerColor }]} />
                  )}
                </View>
              ))}
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Modal>

      <Pressable
        style={(state) => [
          styles.trigger,
          { borderColor, backgroundColor },
          (state as { hovered?: boolean }).hovered && { borderColor: primaryColor },
        ]}
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {icon ? (
          <View style={styles.triggerLead}>
            <Ionicons name={icon} size={15} color={placeholderColor} />
            <ThemedText
              numberOfLines={1}
              style={[styles.triggerText, !selectedOption && { color: placeholderColor }]}
            >
              {selectedOption?.label ?? placeholder}
            </ThemedText>
          </View>
        ) : (
          <ThemedText style={[styles.triggerText, !selectedOption && { color: placeholderColor }]}>
            {selectedOption?.label ?? placeholder}
          </ThemedText>
        )}
        <ThemedText style={[styles.chevron, { color: placeholderColor }]}>▾</ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderRadius: theme.formSizes.inputBorderRadius,
    paddingHorizontal: theme.formSizes.inputPaddingH,
    height: theme.formSizes.inputHeight,
  },
  triggerLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minWidth: 0,
  },
  triggerText: {
    fontSize: theme.formSizes.inputFontSize,
  },
  chevron: {
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalView: {
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 360,
    width: "100%",
    maxWidth: 360,
    overflow: "hidden",
  },
  list: {
    width: "100%",
  },
  separator: {
    height: 1,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  optionText: {
    fontSize: 15,
  },
  checkmark: {
    fontWeight: "600",
  },
});
