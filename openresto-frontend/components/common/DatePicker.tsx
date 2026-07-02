import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { useState } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS, FORM_SIZES, BORDER_RADIUS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";

export function generateDateOptions(options?: {
  allowPast?: boolean;
}): { label: string; value: string }[] {
  const opts = [];
  const today = new Date();
  // Customers can only choose today and later. Admins may back-date within a
  // bounded one-year window so the list stays navigable (opt-in via allowPast).
  const startOffset = options?.allowPast ? -365 : 0;
  for (let i = startOffset; i <= 29; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    // Generate value in local YYYY-MM-DD format
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const value = `${year}-${month}-${day}`;
    opts.push({ label, value });
  }
  return opts;
}

export default function DatePicker({
  selectedDate,
  onSelect,
  openDays,
  allowPast,
}: {
  selectedDate?: string;
  onSelect: (date: string) => void;
  /** ISO day numbers that are open (1=Mon..7=Sun). If omitted, all days allowed. */
  openDays?: number[];
  /**
   * Opt-in: also offer past dates (today-365 .. today). Default false keeps the
   * customer flow restricted to today and later. Used by the admin New Booking modal.
   */
  allowPast?: boolean;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const borderColor = colors.border;
  const placeholderColor = colors.muted;
  const backgroundColor = colors.input;

  const allOptions = generateDateOptions({ allowPast });
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
        onRequestClose={/* istanbul ignore next */ () => setModalVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={/* istanbul ignore next */ () => setModalVisible(false)}
        >
          <ThemedView style={[styles.modalView, { borderColor }]}>
            <ThemedText type="bodyBold" style={styles.modalTitle}>
              Select a date
            </ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === selectedDate && { backgroundColor: `${primaryColor}14` },
                  ]}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <ThemedText
                    style={
                      item.value === selectedDate && { color: primaryColor, fontWeight: "600" }
                    }
                  >
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
          /* istanbul ignore next */
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
    height: FORM_SIZES.inputHeight,
    borderWidth: 1,
    borderRadius: FORM_SIZES.inputBorderRadius,
    paddingHorizontal: FORM_SIZES.inputPaddingH,
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
    borderRadius: BORDER_RADIUS.card,
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
