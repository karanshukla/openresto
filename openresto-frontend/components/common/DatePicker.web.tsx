import { useState } from "react";
import { Modal, StyleSheet, View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

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

/** Convert a YYYY-MM-DD string (or Date) to ISO day-of-week (1=Mon, 7=Sun) */
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
  allowPast,
}: {
  selectedDate?: string;
  onSelect: (date: string) => void;
  /** ISO day numbers that are open (1=Mon..7=Sun). If omitted, all days allowed. */
  openDays?: number[];
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

  return (
    <View style={styles.wrapper} testID="date-picker-web">
      <Pressable
        onPress={openPicker}
        testID="date-picker-trigger"
        style={[
          styles.trigger,
          {
            borderColor: open ? primaryColor : isClosedDay ? theme.colors.error : borderColor,
            backgroundColor: bg,
          },
        ]}
      >
        <ThemedText style={{ color: selectedDate ? textColor : placeholderColor, fontSize: 15 }}>
          {selectedLabel ?? "Select a date"}
        </ThemedText>
        <ThemedText style={[styles.chevron, { color: placeholderColor }]}>▾</ThemedText>
      </Pressable>

      {isClosedDay && (
        <ThemedText style={styles.closedWarning}>
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
        >
          <Pressable
            style={[
              styles.calendar,
              { backgroundColor: colors.card, borderColor },
              theme.shadows.popup,
            ]}
            testID="date-picker-calendar"
            onPress={(e) => e?.stopPropagation?.()}
          >
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={goPrevMonth}
                disabled={!canGoPrev}
                testID="date-picker-prev-month"
                style={styles.navButton}
              >
                <ThemedText
                  style={{ color: canGoPrev ? textColor : placeholderColor, fontSize: 16 }}
                >
                  ‹
                </ThemedText>
              </Pressable>
              <ThemedText style={{ fontSize: 14, fontWeight: "600" }}>
                {MONTH_LABELS[viewMonth]} {viewYear}
              </ThemedText>
              <Pressable
                onPress={goNextMonth}
                disabled={!canGoNext}
                testID="date-picker-next-month"
                style={styles.navButton}
              >
                <ThemedText
                  style={{ color: canGoNext ? textColor : placeholderColor, fontSize: 16 }}
                >
                  ›
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
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
                  const disabled = outOfRange || closedWeekday;
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
  closedWarning: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  calendar: {
    width: 280,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekRow: {
    flexDirection: "row",
  },
  cell: {
    width: 36,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCell: {
    margin: 1,
  },
});
