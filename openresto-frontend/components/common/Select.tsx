import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useState } from "react";
import { Icon, type IconName } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import * as Haptics from "expo-haptics";
import { styles } from "./Select.styles";

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
  icon?: IconName;
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
          accessibilityRole="button"
          accessibilityLabel="Close the options list"
        >
          <ThemedView
            style={[styles.modalView, { borderColor }]}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel ?? placeholder}
          >
            {/*
              Plain ScrollView over FlatList: option counts are small (max ~50 for seat pickers),
              so virtualization buys nothing, and react-native-web's FlatList scroll container
              intercepts the touch-start of a tap (treating it as a potential drag) so the option's
              onPress never fires — the modal just dismisses on pointer-up. A ScrollView with
              nestedScrollEnabled + direct Pressable rows is reliable cross-platform.
            */}
            <ScrollView style={styles.list} nestedScrollEnabled role="menu">
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
                    role="menuitem"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: item.value === selectedValue }}
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
                      <ThemedText
                        style={[styles.checkmark, { color: primaryColor }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      >
                        ✓
                      </ThemedText>
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
        accessibilityLabel={
          accessibilityLabel
            ? `${accessibilityLabel}, ${selectedOption?.label ?? placeholder}`
            : undefined
        }
        accessibilityState={{ expanded: modalVisible }}
      >
        {icon ? (
          <View style={styles.triggerLead}>
            <Icon name={icon} size="md" color={placeholderColor} />
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
        <Icon name="chevron-down" size="md" color={placeholderColor} />
      </Pressable>
    </>
  );
}
