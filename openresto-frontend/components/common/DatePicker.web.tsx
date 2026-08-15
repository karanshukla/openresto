import { useState } from "react";
import { Modal, View, Pressable } from "react-native";
import { Icon, type IconName } from "@/components/common/Icon";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./DatePicker.web.styles";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO day-of-week: 1=Mon … 7=Sun */
function isoDayOf(d: Date): number {
  const jsDay = d.getDay(); // 0=Sun, 6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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
  /** ISO day numbers that are open (1=Mon..7=Sun). If omitted, all days allowed. */
  openDays?: number[];
  /**
   * ISO days the venue is open on but takes no bookings for (walk-in only). Their cells are
   * unpickable like a closed day's, but they are NOT closed: folding them into `openDays`
   * turns the trigger red and claims the venue is shut, and for a location that is walk-in
   * every day it leaves a calendar with no pickable date at all.
   */
  unavailableDays?: number[];
  /** Announced on an unavailable day's cell, e.g. "Walk-ins only". */
  unavailableReason?: string;
  /** Optional leading glyph, for compact filter bars where the label alone is ambiguous. */
  icon?: IconName;
  /** Overrides the trigger label, e.g. a filter bar that says "Today" instead of the date. */
  triggerLabel?: string;
  /**
   * Opt-in: also allow past dates (back to today-365). Default false keeps the
   * customer flow restricted to today and later (hard `min={today}`).
   * Used by the admin New Booking modal.
   */
  allowPast?: boolean;
}) {
  const { colors, primaryColor } = useAppTheme();
  const borderColor = colors.border;
  const bg = colors.input;
  const textColor = colors.text;
  const placeholderColor = colors.muted;

  const today = startOfToday();
  const minDate = (() => {
    const d = new Date(today);
    if (allowPast) d.setDate(d.getDate() - 365);
    return d;
  })();
  const maxDate = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 29);
    return d;
  })();
  const minDateStr = toDateStr(minDate);
  const maxDateStr = toDateStr(maxDate);

  const isClosedDay = !!(
    selectedDate &&
    openDays &&
    !openDays.includes(isoDayOf(new Date(selectedDate + "T12:00:00")))
  );

  const initialView = selectedDate ? new Date(selectedDate + "T12:00:00") : today;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initialView.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialView.getMonth());

  const openPicker = () => {
    const base = selectedDate ? new Date(selectedDate + "T12:00:00") : today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  };

  const prevMonthLastDay = new Date(viewYear, viewMonth, 0);
  const canGoPrev = toDateStr(prevMonthLastDay) >= minDateStr;
  const nextMonthFirstDay = new Date(viewYear, viewMonth + 1, 1);
  const canGoNext = toDateStr(nextMonthFirstDay) <= maxDateStr;

  const goPrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const leadingBlanks = isoDayOf(firstOfMonth) - 1;
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedLabel = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  const describeDate = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  return (
    <View style={styles.wrapper} testID="date-picker-web">
      <Pressable
        onPress={openPicker}
        testID="date-picker-trigger"
        accessibilityRole="button"
        accessibilityLabel={
          selectedLabel ? `Change date, currently ${selectedLabel}` : "Select a date"
        }
        accessibilityState={{ expanded: open }}
        style={[
          styles.trigger,
          {
            borderColor: open ? primaryColor : isClosedDay ? theme.colors.error : borderColor,
            backgroundColor: bg,
          },
        ]}
      >
        {icon ? (
          <View style={styles.triggerLead}>
            <Icon name={icon} size={15} color={placeholderColor} />
            <ThemedText
              numberOfLines={1}
              style={{ color: selectedDate ? textColor : placeholderColor, fontSize: 15 }}
            >
              {triggerLabel ?? selectedLabel ?? "Select a date"}
            </ThemedText>
          </View>
        ) : (
          <ThemedText style={{ color: selectedDate ? textColor : placeholderColor, fontSize: 15 }}>
            {triggerLabel ?? selectedLabel ?? "Select a date"}
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

      {isClosedDay && (
        <ThemedText style={styles.closedWarning} role="alert" accessibilityLiveRegion="polite">
          Note: This restaurant is normally closed on this day. Please double-check another date.
        </ThemedText>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={/* istanbul ignore next */ () => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          testID="date-picker-backdrop"
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close the date picker"
        >
          <Pressable
            style={[
              styles.calendar,
              { backgroundColor: colors.card, borderColor },
              theme.shadows.popup,
            ]}
            testID="date-picker-calendar"
            onPress={(e) => e?.stopPropagation?.()}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel="Choose a date"
          >
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={goPrevMonth}
                disabled={!canGoPrev}
                testID="date-picker-prev-month"
                style={styles.navButton}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                accessibilityState={{ disabled: !canGoPrev }}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <ThemedText
                  style={{ color: canGoPrev ? textColor : placeholderColor, fontSize: 16 }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  ‹
                </ThemedText>
              </Pressable>
              <ThemedText style={{ fontSize: 14, fontWeight: "600" }} accessibilityRole="header">
                {MONTH_LABELS[viewMonth]} {viewYear}
              </ThemedText>
              <Pressable
                onPress={goNextMonth}
                disabled={!canGoNext}
                testID="date-picker-next-month"
                style={styles.navButton}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                accessibilityState={{ disabled: !canGoNext }}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <ThemedText
                  style={{ color: canGoNext ? textColor : placeholderColor, fontSize: 16 }}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  ›
                </ThemedText>
              </Pressable>
            </View>

            <View
              style={styles.weekdayRow}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {WEEKDAY_LABELS.map((label) => (
                <View key={label} style={styles.cell}>
                  <ThemedText style={{ fontSize: 11, color: placeholderColor, fontWeight: "600" }}>
                    {label}
                  </ThemedText>
                </View>
              ))}
            </View>

            {Array.from({ length: cells.length / 7 }, (_, row) => (
              <View key={row} style={styles.weekRow}>
                {cells.slice(row * 7, row * 7 + 7).map((dayNum, col) => {
                  if (dayNum === null) return <View key={col} style={styles.cell} />;
                  const cellDate = new Date(viewYear, viewMonth, dayNum);
                  const cellStr = toDateStr(cellDate);
                  const outOfRange = cellStr < minDateStr || cellStr > maxDateStr;
                  const closedWeekday = !!openDays && !openDays.includes(isoDayOf(cellDate));
                  const unbookableWeekday = !!unavailableDays?.includes(isoDayOf(cellDate));
                  const disabled = outOfRange || closedWeekday || unbookableWeekday;
                  const isSelected = cellStr === selectedDate;
                  return (
                    <Pressable
                      key={col}
                      disabled={disabled}
                      testID={`date-picker-day-${cellStr}`}
                      onPress={() => {
                        onSelect(cellStr);
                        setOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={describeDate(cellDate)}
                      accessibilityHint={
                        closedWeekday
                          ? "Normally closed"
                          : unbookableWeekday
                            ? unavailableReason
                            : undefined
                      }
                      accessibilityState={{ disabled, selected: isSelected }}
                      style={[
                        styles.cell,
                        styles.dayCell,
                        isSelected && {
                          backgroundColor: primaryColor,
                          borderRadius: theme.borderRadius.sm,
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          fontSize: 13,
                          color: isSelected
                            ? theme.colors.white
                            : disabled
                              ? colors.disabled
                              : textColor,
                          fontWeight: isSelected ? "600" : "400",
                        }}
                      >
                        {dayNum}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
