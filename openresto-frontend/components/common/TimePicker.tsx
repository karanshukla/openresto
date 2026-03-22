import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";

function generateTimeOptions(minTime: string, maxTime: string): { label: string; value: string }[] {
  const [minH, minM] = minTime.split(":").map(Number);
  const [maxH, maxM] = maxTime.split(":").map(Number);
  const minTotal = minH * 60 + minM;
  const maxTotal = maxH * 60 + maxM;

  const options = [];
  for (let total = minTotal; total <= maxTotal; total += 15) {
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    const h = hour.toString().padStart(2, "0");
    const m = minute.toString().padStart(2, "0");
    const value = `${h}:${m}`;
    const period = hour < 12 ? "AM" : "PM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const label = `${displayHour}:${m} ${period}`;
    options.push({ label, value });
  }
  return options;
}

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
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.18)";
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
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)}>
          <ThemedView style={[styles.modalView, { borderColor }]}>
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
              Select a time
            </ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item.value === selectedTime && styles.selectedOption]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <ThemedText style={item.value === selectedTime && styles.selectedText}>
                    {item.label}
                  </ThemedText>
                  {item.value === selectedTime && (
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
          (state as any).hovered && styles.triggerHovered,
          { cursor: "pointer" } as any,
        ]}
        onPress={() => setModalVisible(true)}
      >
        <ThemedText style={!selected && styles.placeholder}>
          {selected?.label ?? "Select a time"}
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
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  triggerHovered: {
    borderColor: "#0a7ea4",
  },
  placeholder: {
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
    maxWidth: 280,
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
  selectedOption: {
    backgroundColor: "rgba(10,126,164,0.08)",
  },
  selectedText: {
    fontWeight: "600",
    color: "#0a7ea4",
  },
  checkmark: {
    color: "#0a7ea4",
    fontWeight: "600",
  },
});
