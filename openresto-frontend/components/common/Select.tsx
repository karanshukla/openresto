import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Platform, Pressable, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS, FORM_SIZES } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
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
  const colorScheme = useColorScheme() ?? "light";
  const isDark = colorScheme === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
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
        /* istanbul ignore next */
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          /* istanbul ignore next */
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
                    if (Platform.OS !== "web") {
                      Haptics.selectionAsync();
                    }
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
    borderRadius: FORM_SIZES.inputBorderRadius,
    paddingHorizontal: FORM_SIZES.inputPaddingH,
    height: FORM_SIZES.inputHeight,
  },
  triggerText: {
    fontSize: FORM_SIZES.inputFontSize,
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
