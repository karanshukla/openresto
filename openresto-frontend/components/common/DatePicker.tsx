import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Platform, Pressable, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fmtDate } from "@/utils/formatters";
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
    const label = fmtDate(d);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const value = `${year}-${month}-${day}`;
    opts.push({ label, value });
  }
  return opts;
}

/**
 * A `YYYY-MM-DD` string as a date in the viewer's own timezone. Parsing it as ISO would read
 * it as UTC and land on the previous day for anyone behind it.
 */
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toLocalDateValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The window the picker offers, taken from the same generator the values come from so the
 * bounds and the labels cannot drift apart.
 *
 * @see [DatePicker.test.tsx](../../tests/components/DatePicker.test.tsx) — pins that the
 * customer window opens today and that `allowPast` reaches back a year.
 */
export function pickerRange(allowPast?: boolean): { minimumDate: Date; maximumDate: Date } {
  const window = generateDateOptions({ allowPast });
  return {
    minimumDate: parseLocalDate(window[0].value),
    maximumDate: parseLocalDate(window[window.length - 1].value),
  };
}

/**
 * The props both implementations of the picker take. The three "which days" props are read by
 * `DatePicker.web.tsx`, which draws its own list and can therefore drop or disable a day; the
 * system calendar below clamps to a range and cannot, so it accepts them and leaves them
 * unread rather than making every call site branch on platform (#423).
 */
export interface DatePickerProps {
  selectedDate?: string;
  onSelect: (date: string) => void;
  /**
   * ISO day numbers the venue opens on (1=Mon..7=Sun). Off web, picking a closed day is
   * answered downstream by `booking.form.closedDayNotice` rather than by a day that was never
   * offered.
   */
  openDays?: number[];
  /**
   * ISO days the venue is open on but takes no bookings for (walk-in only). Same story off
   * web: the notice lives downstream, in `WalkInDaysBanner`, not on the day itself.
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
}

/**
 * The guest's first touch in the booking flow, and off web that has to be the platform's own
 * calendar rather than a list of days — a scrolling listbox is the single loudest "this is a
 * wrapped website" tell in the app (#423). `DatePicker.web.tsx` keeps the listbox, which is
 * the right control in a browser.
 *
 * @see [DatePicker.test.tsx](../../tests/components/DatePicker.test.tsx) — pins the pick and
 * dismiss paths, the per-platform presentation, and that a day the venue cannot seat is now
 * reported upward for the form to explain.
 */
export default function DatePicker({
  selectedDate,
  onSelect,
  allowPast,
  icon,
  triggerLabel,
}: DatePickerProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  const borderColor = colors.border;
  const placeholderColor = colors.muted;
  const backgroundColor = colors.input;

  const { minimumDate, maximumDate } = pickerRange(allowPast);
  // Formatted from what the caller selected rather than looked up in the offered window, so a
  // date from outside it — a deep link, a filter spanning several locations — still names
  // itself on the trigger rather than reading as a control that has lost its value.
  const selectedLabel = selectedDate ? fmtDate(parseLocalDate(selectedDate)) : undefined;
  const value = selectedDate ? parseLocalDate(selectedDate) : new Date();

  /**
   * One handler for both platforms: iOS's inline calendar reports a tap as `set` the same way
   * Android's dialog reports its OK button, and Android's cancel arrives as `dismissed`.
   */
  const handleChange = (event: DateTimePickerEvent, picked?: Date) => {
    setPickerVisible(false);
    if (event.type !== "set" || !picked) return;
    onSelect(toLocalDateValue(picked));
  };

  const control = (
    <DateTimePicker
      testID="date-picker-control"
      mode="date"
      // Inline is the month grid; Android's own dialog is the platform default and ignores this.
      display={Platform.OS === "ios" ? "inline" : "default"}
      value={value}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      onChange={handleChange}
      accentColor={primaryColor}
      themeVariant={isDark ? "dark" : "light"}
    />
  );

  return (
    <>
      {/* Android's picker presents its own dialog, so wrapping it in a Modal would stack two.
          iOS's inline calendar is a plain view and needs one to sit in. */}
      {pickerVisible && Platform.OS !== "ios" && control}

      {Platform.OS === "ios" && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={pickerVisible}
          onRequestClose={/* istanbul ignore next */ () => setPickerVisible(false)}
        >
          <Pressable
            style={styles.backdrop}
            onPress={/* istanbul ignore next */ () => setPickerVisible(false)}
            accessibilityRole="button"
            accessibilityLabel={t("common.datePicker.closeButtonLabel")}
          >
            {/* The card swallows its own presses. Without this, anything inside it that does
                not consume a press — the title, or the calendar's own padding — reaches the
                backdrop and dismisses the picker, which reads as the date control refusing to
                work rather than as a press landing on nothing. */}
            <Pressable accessible={false} focusable={false} onPress={() => {}} style={styles.card}>
              <ThemedView
                style={[styles.modalView, { borderColor }]}
                role="dialog"
                aria-modal
                accessibilityViewIsModal
                accessibilityLabel={t("common.datePicker.selectDate")}
              >
                <ThemedText type="bodyBold" style={styles.modalTitle} accessibilityRole="header">
                  {t("common.datePicker.selectDate")}
                </ThemedText>
                {control}
              </ThemedView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <Pressable
        style={(state) => [
          styles.trigger,
          { borderColor, backgroundColor },
          /* istanbul ignore next */
          (state as { hovered?: boolean }).hovered && { borderColor: primaryColor },
        ]}
        onPress={() => setPickerVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={
          selectedLabel
            ? t("common.datePicker.changeDate", { date: selectedLabel })
            : t("common.datePicker.selectDate")
        }
        accessibilityState={{ expanded: pickerVisible }}
      >
        {icon ? (
          <View style={styles.triggerLead}>
            <Icon name={icon} size="md" color={placeholderColor} />
            <ThemedText
              numberOfLines={1}
              style={[styles.triggerText, !selectedLabel && { color: placeholderColor }]}
            >
              {triggerLabel ?? selectedLabel ?? t("common.datePicker.selectDate")}
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            numberOfLines={1}
            style={[styles.triggerText, !selectedLabel && { color: placeholderColor }]}
          >
            {triggerLabel ?? selectedLabel ?? t("common.datePicker.selectDate")}
          </ThemedText>
        )}
        <Icon name="chevron-down" size="md" color={placeholderColor} />
      </Pressable>
    </>
  );
}
