import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { generateTimeOptions } from "@/utils/timeOptions";

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
  const { colors, primaryColor } = useAppTheme();
  const borderColor = colors.border;
  const bg = colors.input;
  const textColor = colors.text;
  const placeholderColor = colors.muted;

  const [open, setOpen] = useState(false);
  const options = generateTimeOptions(minTime, maxTime);

  return (
    <View style={styles.wrapper} testID="time-picker-web">
      <Pressable
        onPress={() => setOpen(true)}
        testID="time-picker-trigger"
        style={[
          styles.trigger,
          { borderColor: open ? primaryColor : borderColor, backgroundColor: bg },
        ]}
      >
        <ThemedText style={{ color: selectedTime ? textColor : placeholderColor, fontSize: 15 }}>
          {selectedTime ?? "Select a time"}
        </ThemedText>
        <ThemedText style={[styles.chevron, { color: placeholderColor }]}>▾</ThemedText>
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={/* istanbul ignore next */ () => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          testID="time-picker-backdrop"
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.panel,
              { backgroundColor: colors.card, borderColor },
              theme.shadows.popup,
            ]}
            testID="time-picker-panel"
            onPress={(e) => e?.stopPropagation?.()}
          >
            <ThemedText type="bodyBold" style={styles.panelTitle}>
              Select a time
            </ThemedText>
            <ScrollView style={styles.list} testID="time-picker-list">
              {options.map((option) => {
                const isSelected = option.value === selectedTime;
                return (
                  <Pressable
                    key={option.value}
                    testID={`time-picker-option-${option.value}`}
                    onPress={() => {
                      onSelect(option.value);
                      setOpen(false);
                    }}
                    style={[styles.option, isSelected && { backgroundColor: `${primaryColor}14` }]}
                  >
                    <ThemedText style={isSelected && { color: primaryColor, fontWeight: "600" }}>
                      {option.label}
                    </ThemedText>
                    {isSelected && (
                      <ThemedText style={[styles.checkmark, { color: primaryColor }]}>✓</ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
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
  panel: {
    width: 240,
    maxHeight: 360,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    overflow: "hidden",
    paddingVertical: 8,
  },
  panelTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    width: "100%",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkmark: {
    fontWeight: "600",
  },
});
