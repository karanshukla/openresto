import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useState } from "react";
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
}: {
  options: SelectOption[];
  onSelect: (value: string | number) => void;
  selectedValue?: string | number;
  placeholder?: string;
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
            <FlatList
              data={options}
              keyExtractor={(item) => item.value.toString()}
              style={styles.list}
              ItemSeparatorComponent={() => (
                <ThemedView style={[styles.separator, { backgroundColor: dividerColor }]} />
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === selectedValue && { backgroundColor: `${primaryColor}14` },
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
                </TouchableOpacity>
              )}
            />
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
      >
        <ThemedText style={[styles.triggerText, !selectedOption && { color: placeholderColor }]}>
          {selectedOption?.label ?? placeholder}
        </ThemedText>
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
    borderWidth: 1,
    borderRadius: theme.formSizes.inputBorderRadius,
    paddingHorizontal: theme.formSizes.inputPaddingH,
    height: theme.formSizes.inputHeight,
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
