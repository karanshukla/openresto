import { useEffect, useRef, useState } from "react";
import { Modal, View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "@/components/common/Icon";
import { IconButton } from "@/components/common/IconButton";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { clampToRange, resolveCalendarKey, shiftCalendarMonths } from "@/utils/calendarKeys";
import { GRIDCELL_ROLE, webProps, type WebKeyEvent } from "@/utils/webProps";
import { fmtDateString, fmtLongDate } from "@/utils/formatters";
import { getActiveLocale } from "@/utils/locale";
import { styles } from "./DatePicker.web.styles";

/** 2024-01-01 is a Monday, so index 0 lines up with the calendar's Mon-first week. */
const WEEKDAY_REFERENCE = (index: number) => new Date(2024, 0, 1 + index);

/** Locale-aware weekday name for the header row, e.g. "Mon" or "lun." — follows the active UI language rather than a hardcoded English array. */
function weekdayShortLabel(index: number): string {
  return new Intl.DateTimeFormat(getActiveLocale(), { weekday: "short" }).format(
    WEEKDAY_REFERENCE(index)
  );
}

/** Full weekday name, for the header row's accessibilityLabel. */
function weekdayFullLabel(index: number): string {
  return new Intl.DateTimeFormat(getActiveLocale(), { weekday: "long" }).format(
    WEEKDAY_REFERENCE(index)
  );
}

/** Locale-aware "Month Year" label, e.g. "January 2026" or "janvier 2026". */
function monthYearLabel(date: Date): string {
  return new Intl.DateTimeFormat(getActiveLocale(), { month: "long", year: "numeric" }).format(
    date
  );
}

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

/**
 * The month grid of days, as an ARIA `grid` with a roving tab stop.
 *
 * The highlighted day is the whole month's single tab stop and every other cell is `tabIndex`
 * -1: a month used to be up to 31 tab stops with no way past them, so reaching the end of the
 * dialog took about 33 presses (issue #350). Arrow keys move the highlight from there, and
 * because the highlighted day is also what the calendar renders around, arrowing off the end of
 * a month pages the view for free.
 *
 * @see [DatePickerWeb.test.tsx](../../tests/components/common/DatePickerWeb.test.tsx) — pins the
 * single tab stop, the grid roles, and that a key on the grid moves the highlight and the month.
 */
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
  const { t } = useTranslation();
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

  const [open, setOpen] = useState(false);
  // The highlighted day is the calendar's one piece of position state: the visible month is
  // read off it, so nothing can page the grid away from the day the keyboard is on.
  const [focused, setFocused] = useState(() =>
    clampToRange(selectedDate ?? toDateStr(today), minDateStr, maxDateStr)
  );
  const calendarRef = useRef<View>(null);
  const dayRefs = useRef<Record<string, View | null>>({});
  const followFocus = useRef(false);
  useDialogFocus(open, calendarRef);

  const viewDate = new Date(focused + "T12:00:00");
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const isUnpickable = (dateStr: string) => {
    if (dateStr < minDateStr || dateStr > maxDateStr) return true;
    const isoDay = isoDayOf(new Date(dateStr + "T12:00:00"));
    return (!!openDays && !openDays.includes(isoDay)) || !!unavailableDays?.includes(isoDay);
  };

  const commit = (dateStr: string) => {
    if (isUnpickable(dateStr)) return;
    onSelect(dateStr);
    setOpen(false);
  };

  /**
   * Hung on the dialog *and* on every day cell, because neither alone hears every key. The
   * dialog is where focus lands — react-native-web's modal trap fires after the open animation
   * and `useDialogFocus` takes it back to the card — but a cell holding focus stops Enter and
   * Space from ever reaching it, since RNW treats them as a press on itself and halts them
   * there. Handled keys stop where they are caught, so the two placements never both fire.
   */
  const handleKey = (event: WebKeyEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const result = resolveCalendarKey(event.key, {
      focused,
      min: minDateStr,
      max: maxDateStr,
    });
    if (result.handled) {
      // Enter's default action is to activate the nearest ancestor that has one, and inside this
      // modal that is the backdrop `button` that closes it — so a day taken with Enter used to
      // dismiss the calendar instead.
      event.preventDefault?.();
      event.stopPropagation?.();
    }
    if (result.focused !== undefined) {
      followFocus.current = true;
      setFocused(result.focused);
    }
    if (result.commit) commit(focused);
    if (result.close) setOpen(false);
  };

  // Focus follows the highlight, so a screen reader announces each day the arrows land on. Only
  // for a key that moved it: a month arrow moves the highlight too, and pulling focus off the
  // button would leave a diner unable to press it twice.
  useEffect(() => {
    if (!open || !followFocus.current) return;
    followFocus.current = false;
    (dayRefs.current[focused] as unknown as HTMLElement | null)?.focus?.();
  }, [open, focused]);

  const openPicker = () => {
    setFocused(clampToRange(selectedDate ?? toDateStr(today), minDateStr, maxDateStr));
    setOpen(true);
  };

  const prevMonthLastDay = new Date(viewYear, viewMonth, 0);
  const canGoPrev = toDateStr(prevMonthLastDay) >= minDateStr;
  const nextMonthFirstDay = new Date(viewYear, viewMonth + 1, 1);
  const canGoNext = toDateStr(nextMonthFirstDay) <= maxDateStr;

  const stepMonth = (months: number) =>
    setFocused((current) =>
      clampToRange(shiftCalendarMonths(current, months), minDateStr, maxDateStr)
    );

  const goPrevMonth = () => {
    if (canGoPrev) stepMonth(-1);
  };

  const goNextMonth = () => {
    if (canGoNext) stepMonth(1);
  };

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const leadingBlanks = isoDayOf(firstOfMonth) - 1;
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedLabel = selectedDate ? fmtDateString(selectedDate) : null;

  const describeDate = (d: Date) => fmtLongDate(d);

  return (
    <View style={styles.wrapper} testID="date-picker-web">
      <Pressable
        onPress={openPicker}
        testID="date-picker-trigger"
        accessibilityRole="button"
        accessibilityLabel={
          selectedLabel
            ? t("common.datePicker.changeDate", { date: selectedLabel })
            : t("common.datePicker.selectDate")
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
            <Icon name={icon} size="md" color={placeholderColor} />
            <ThemedText
              numberOfLines={1}
              style={[styles.triggerText, { color: selectedDate ? textColor : placeholderColor }]}
            >
              {triggerLabel ?? selectedLabel ?? t("common.datePicker.selectDate")}
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            numberOfLines={1}
            style={[styles.triggerText, { color: selectedDate ? textColor : placeholderColor }]}
          >
            {triggerLabel ?? selectedLabel ?? t("common.datePicker.selectDate")}
          </ThemedText>
        )}
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
          testID="date-picker-backdrop"
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t("common.datePicker.closeButtonLabel")}
        >
          <Pressable
            ref={calendarRef}
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
            accessibilityLabel={t("common.datePicker.chooseDate")}
            tabIndex={-1}
            {...webProps({ onKeyDown: handleKey })}
          >
            <View style={styles.calendarHeader}>
              <IconButton
                name="chevron-back"
                onPress={goPrevMonth}
                disabled={!canGoPrev}
                testID="date-picker-prev-month"
                accessibilityLabel={t("common.datePicker.previousMonth")}
                color={canGoPrev ? textColor : placeholderColor}
                size="md"
                compact
              />
              <ThemedText style={{ fontSize: 14, fontWeight: "600" }} accessibilityRole="header">
                {monthYearLabel(viewDate)}
              </ThemedText>
              <IconButton
                name="chevron-forward"
                onPress={goNextMonth}
                disabled={!canGoNext}
                testID="date-picker-next-month"
                accessibilityLabel={t("common.datePicker.nextMonth")}
                color={canGoNext ? textColor : placeholderColor}
                size="md"
                compact
              />
            </View>

            <View
              role="grid"
              testID="date-picker-grid"
              accessibilityLabel={monthYearLabel(viewDate)}
            >
              <View style={styles.weekdayRow} role="row">
                {Array.from({ length: 7 }, (_, i) => weekdayShortLabel(i)).map((label, i) => (
                  <View
                    key={label}
                    style={styles.cell}
                    role="columnheader"
                    accessibilityLabel={weekdayFullLabel(i)}
                  >
                    <ThemedText
                      style={{ fontSize: 11, color: placeholderColor, fontWeight: "600" }}
                    >
                      {label}
                    </ThemedText>
                  </View>
                ))}
              </View>

              {Array.from({ length: cells.length / 7 }, (_, row) => (
                <View key={row} style={styles.weekRow} role="row">
                  {cells.slice(row * 7, row * 7 + 7).map((dayNum, col) => {
                    if (dayNum === null)
                      return <View key={col} style={styles.cell} role={GRIDCELL_ROLE} />;
                    const cellDate = new Date(viewYear, viewMonth, dayNum);
                    const cellStr = toDateStr(cellDate);
                    const closedWeekday = !!openDays && !openDays.includes(isoDayOf(cellDate));
                    const unbookableWeekday = !!unavailableDays?.includes(isoDayOf(cellDate));
                    const disabled = isUnpickable(cellStr);
                    const isSelected = cellStr === selectedDate;
                    const isFocused = cellStr === focused;
                    return (
                      <Pressable
                        key={col}
                        ref={(node) => {
                          dayRefs.current[cellStr] = node;
                        }}
                        disabled={disabled}
                        testID={`date-picker-day-${cellStr}`}
                        onPress={() => commit(cellStr)}
                        role={GRIDCELL_ROLE}
                        {...webProps({ onKeyDown: handleKey })}
                        aria-selected={isSelected}
                        // The month's one tab stop. Every other day is reached by arrowing the
                        // highlight, not by tabbing through thirty of them.
                        tabIndex={isFocused ? 0 : -1}
                        accessibilityLabel={describeDate(cellDate)}
                        accessibilityHint={
                          closedWeekday
                            ? t("common.datePicker.normallyClosed")
                            : unbookableWeekday
                              ? unavailableReason
                              : undefined
                        }
                        accessibilityState={{ disabled, selected: isSelected }}
                        style={[
                          styles.cell,
                          styles.dayCell,
                          isFocused && { borderColor: primaryColor },
                          isSelected && { backgroundColor: primaryColor },
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
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
