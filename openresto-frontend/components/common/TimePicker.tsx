import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useState } from "react";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { generateTimeOptions } from "@/utils/timeOptions";

export { generateTimeOptions };

export default function TimePicker({
  selectedTime,
  onSelect,
  minTime = "09:00",
  maxTime = "22:00",
}: {
  selectedTime?: string;
  onSelect: (time: string) => void;
  minTime?: string;
  maxTime?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors, primaryColor } = useAppTheme();
  const borderColor = colors.border;
  const placeholderColor = colors.muted;
  const backgroundColor = colors.input;
  const options = generateTimeOptions(minTime, maxTime);
  const selected = options.find((o) => o.value === selectedTime);

  return (
    <>
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          testID="time-picker-backdrop"
          style={styles.backdrop}
          onPress={() => setModalVisible(false)}
        >
          <ThemedView style={[styles.modalView, { borderColor }]}>
            <ThemedText type="bodyBold" style={styles.modalTitle}>
              Select a time
            </ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === selectedTime && { backgroundColor: `${primaryColor}14` },
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <ThemedText
                    style={
                      item.value === selectedTime && { color: primaryColor, fontWeight: "600" }
                    }
                  >
                    {item.label}
                  </ThemedText>
                  {item.value === selectedTime && (
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
        <ThemedText style={!selected && { color: placeholderColor }}>
          {selected?.label ?? "Select a time"}
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
    height: theme.formSizes.inputHeight,
    borderWidth: 1,
    borderRadius: theme.formSizes.inputBorderRadius,
    paddingHorizontal: theme.formSizes.inputPaddingH,
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
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    maxHeight: 400,
    width: "100%",
    maxWidth: 320,
    overflow: "hidden",
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  list: {
    width: "100%",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionText: {
    fontSize: 15,
  },
  checkmark: {
    fontWeight: "600",
  },
});
