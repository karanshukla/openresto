import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, StyleSheet, FlatList, TouchableOpacity, View } from "react-native";
import { useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";

function generateDateOptions(): { label: string; value: string }[] {
  const options = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const value = d.toISOString().split("T")[0];
    options.push({ label, value });
  }
  return options;
}

export default function DatePicker({
  selectedDate,
  onSelect,
  openDays,
}: {
  selectedDate?: string;
  onSelect: (date: string) => void;
  openDays?: number[];
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const borderColor = colors.border;
  const placeholderColor = colors.muted;
  const backgroundColor = colors.input;

  const allOptions = generateDateOptions();
  const options = openDays
    ? allOptions.filter((o) => {
        const jsDay = new Date(o.value + "T12:00:00").getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        return openDays.includes(isoDay);
      })
    : allOptions;
  const selected = options.find((o) => o.value === selectedDate);

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
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
              Select a date
            </ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === selectedDate && { backgroundColor: `${primaryColor}14` }]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <ThemedText style={item.value === selectedDate && { color: primaryColor, fontWeight: "600" }}>
                    {item.label}
                  </ThemedText>
                  {item.value === selectedDate && (
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
          {selected?.label ?? "Select a date"}
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalView: {
    borderRadius: 12,
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
