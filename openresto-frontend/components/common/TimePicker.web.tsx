import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { generateTimeOptions } from "@/utils/timeOptions";
import { styles } from "./TimePicker.web.styles";

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
        accessibilityRole="button"
        accessibilityLabel={
          selectedTime ? `Change time, currently ${selectedTime}` : "Select a time"
        }
        accessibilityState={{ expanded: open }}
        style={[
          styles.trigger,
          { borderColor: open ? primaryColor : borderColor, backgroundColor: bg },
        ]}
      >
        <ThemedText
          style={[styles.triggerText, { color: selectedTime ? textColor : placeholderColor }]}
        >
          {selectedTime ?? "Select a time"}
        </ThemedText>
        <Icon name="chevron-down" size="md" color={placeholderColor} />
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
          accessibilityRole="button"
          accessibilityLabel="Close the time picker"
        >
          <Pressable
            style={[
              styles.panel,
              { backgroundColor: colors.card, borderColor },
              theme.shadows.popup,
            ]}
            testID="time-picker-panel"
            onPress={(e) => e?.stopPropagation?.()}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel="Select a time"
          >
            <ThemedText type="bodyBold" style={styles.panelTitle} accessibilityRole="header">
              Select a time
            </ThemedText>
            <ScrollView style={styles.list} testID="time-picker-list" role="menu">
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
                    role="menuitem"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.option, isSelected && { backgroundColor: `${primaryColor}14` }]}
                  >
                    <ThemedText style={isSelected && { color: primaryColor, fontWeight: "600" }}>
                      {option.label}
                    </ThemedText>
                    {isSelected && (
                      <ThemedText
                        style={[styles.checkmark, { color: primaryColor }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      >
                        ✓
                      </ThemedText>
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
