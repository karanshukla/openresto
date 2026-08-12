import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, FlatList, TouchableOpacity, View } from "react-native";
import { useState } from "react";
import { Icon, type IconName } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./DatePicker.styles";

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
  icon,
  triggerLabel,
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
  /** Optional leading glyph, for compact filter bars where the label alone is ambiguous. */
  icon?: IconName;
  /** Overrides the trigger label, e.g. a filter bar that says "Today" instead of the date. */
  triggerLabel?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors, primaryColor } = useAppTheme();
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
          accessibilityRole="button"
          accessibilityLabel="Close the date picker"
        >
          <ThemedView
            style={[styles.modalView, { borderColor }]}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel="Select a date"
          >
            <ThemedText type="bodyBold" style={styles.modalTitle} accessibilityRole="header">
              Select a date
            </ThemedText>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={styles.list}
              role="menu"
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
                  role="menuitem"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: item.value === selectedDate }}
                >
                  <ThemedText
                    style={
                      item.value === selectedDate && { color: primaryColor, fontWeight: "600" }
                    }
                  >
                    {item.label}
                  </ThemedText>
                  {item.value === selectedDate && (
                    <ThemedText
                      style={[styles.checkmark, { color: primaryColor }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    >
                      ✓
                    </ThemedText>
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
        accessibilityRole="button"
        accessibilityLabel={selected ? `Change date, currently ${selected.label}` : "Select a date"}
        accessibilityState={{ expanded: modalVisible }}
      >
        {icon ? (
          <View style={styles.triggerLead}>
            <Icon name={icon} size={15} color={placeholderColor} />
            <ThemedText numberOfLines={1} style={!selected && { color: placeholderColor }}>
              {triggerLabel ?? selected?.label ?? "Select a date"}
            </ThemedText>
          </View>
        ) : (
          <ThemedText style={!selected && { color: placeholderColor }}>
            {triggerLabel ?? selected?.label ?? "Select a date"}
          </ThemedText>
        )}
        <ThemedText
          style={[styles.chevron, { color: placeholderColor }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          ▾
        </ThemedText>
      </Pressable>
    </>
  );
}
