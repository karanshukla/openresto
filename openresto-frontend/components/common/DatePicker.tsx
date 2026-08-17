import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Pressable, FlatList, TouchableOpacity, View } from "react-native";
import { useState } from "react";
import { Icon, type IconName } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { LISTBOX_ROLE } from "@/utils/webProps";
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
  unavailableDays,
  unavailableReason,
  allowPast,
  icon,
  triggerLabel,
}: {
  selectedDate?: string;
  onSelect: (date: string) => void;
  /**
   * ISO day numbers offered in the list (1=Mon..7=Sun); every other weekday is left out.
   * If omitted, all days are allowed. A day the venue is shut is not a candidate at all,
   * which is why it is absent rather than disabled.
   */
  openDays?: number[];
  /**
   * ISO days that stay in the list but cannot be picked, with `unavailableReason` printed
   * beside them. For a day the venue is open on and simply takes no bookings for (walk-in
   * only), "listed but refused, and here's why" tells the diner something that leaving the
   * day out cannot: they can still turn up.
   */
  unavailableDays?: number[];
  unavailableReason?: string;
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

  const isoDayOf = (date: string) => {
    const jsDay = new Date(date + "T12:00:00").getDay();
    return jsDay === 0 ? 7 : jsDay;
  };

  const allOptions = generateDateOptions({ allowPast });
  const options = openDays
    ? allOptions.filter((o) => openDays.includes(isoDayOf(o.value)))
    : allOptions;
  const isUnavailable = (date: string) => !!unavailableDays?.includes(isoDayOf(date));
  // Resolved against the full list, not the offered one: the caller can hand us a date that
  // is closed or unbookable (a deep link, or a date filter that spans several locations), and
  // a trigger that answers "Select a date" for a date already selected reads as a control
  // that has lost its value rather than one holding a value it won't offer again.
  const selected = allOptions.find((o) => o.value === selectedDate);

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
          {/* The card swallows its own presses. Without this, anything inside it that does
              not consume a press — the title, or a day that can't be picked — reaches the
              backdrop and dismisses the picker, which reads as the date control refusing to
              work rather than refusing that one day. */}
          <Pressable accessible={false} focusable={false} onPress={() => {}} style={styles.card}>
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
                role={LISTBOX_ROLE}
                renderItem={({ item }) => {
                  const unavailable = isUnavailable(item.value);
                  const isSelected = item.value === selectedDate;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.option,
                        isSelected && { backgroundColor: `${primaryColor}14` },
                      ]}
                      // An unpickable row stays pressable so the press dies here. Marking it
                      // `disabled` instead leaves the press to bubble to the backdrop, which
                      // dismisses the picker — tapping a greyed-out day would then look like
                      // the date control refusing to work rather than refusing that one day.
                      onPress={(event) => {
                        if (unavailable) {
                          event?.stopPropagation?.();
                          return;
                        }
                        onSelect(item.value);
                        setModalVisible(false);
                      }}
                      role="option"
                      accessibilityLabel={
                        unavailable && unavailableReason
                          ? `${item.label}, ${unavailableReason}`
                          : item.label
                      }
                      accessibilityState={{ selected: isSelected, disabled: unavailable }}
                    >
                      <ThemedText
                        style={[
                          unavailable && { color: placeholderColor },
                          isSelected && !unavailable && { color: primaryColor, fontWeight: "600" },
                        ]}
                      >
                        {item.label}
                      </ThemedText>
                      {unavailable && unavailableReason ? (
                        <ThemedText
                          style={[styles.optionNote, { color: placeholderColor }]}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        >
                          {unavailableReason}
                        </ThemedText>
                      ) : (
                        isSelected && (
                          <ThemedText
                            style={[styles.checkmark, { color: primaryColor }]}
                            accessibilityElementsHidden
                            importantForAccessibility="no"
                          >
                            ✓
                          </ThemedText>
                        )
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </ThemedView>
          </Pressable>
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
            <Icon name={icon} size="md" color={placeholderColor} />
            <ThemedText
              numberOfLines={1}
              style={[styles.triggerText, !selected && { color: placeholderColor }]}
            >
              {triggerLabel ?? selected?.label ?? "Select a date"}
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            numberOfLines={1}
            style={[styles.triggerText, !selected && { color: placeholderColor }]}
          >
            {triggerLabel ?? selected?.label ?? "Select a date"}
          </ThemedText>
        )}
        <Icon name="chevron-down" size="md" color={placeholderColor} />
      </Pressable>
    </>
  );
}
