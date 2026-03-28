import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";

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
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
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
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
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
                  style={[styles.option, item.value === selectedValue && styles.selectedOption]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      item.value === selectedValue && styles.selectedOptionText,
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                  {item.value === selectedValue && (
                    <ThemedText style={styles.checkmark}>✓</ThemedText>
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
          { borderColor },
          (state as { hovered?: boolean }).hovered && styles.triggerHovered,
        ]}
        onPress={() => setModalVisible(true)}
      >
        <ThemedText style={[styles.triggerText, !selectedOption && styles.placeholderText]}>
          {selectedOption?.label ?? placeholder}
        </ThemedText>
        <ThemedText style={styles.chevron}>▾</ThemedText>
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
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  triggerHovered: {
    borderColor: "#0a7ea4",
  },
  triggerText: {
    fontSize: 15,
  },
  placeholderText: {
    color: "#9ca3af",
  },
  chevron: {
    fontSize: 14,
    color: "#9ca3af",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalView: {
    borderRadius: 12,
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
  selectedOption: {
    backgroundColor: "rgba(10,126,164,0.08)",
  },
  optionText: {
    fontSize: 15,
  },
  selectedOptionText: {
    fontWeight: "600",
    color: "#0a7ea4",
  },
  checkmark: {
    color: "#0a7ea4",
    fontWeight: "600",
  },
});
