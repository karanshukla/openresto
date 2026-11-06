import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import DatePicker from "@/components/common/DatePicker";
import TimePicker from "@/components/common/TimePicker";
import { RowTextButton } from "@/components/common/RowTextButton";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import type { DateExceptionDto, DateExceptionType } from "@/api/restaurants";
import { getIsoDayFromDateString } from "@/utils/openingHours";
import { upcomingDateExceptions } from "@/utils/dateExceptions";
import { fmtDateString } from "@/utils/formatters";
import { theme } from "@/theme/theme";
import { modeButton } from "./sectionHelpers";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { LastBookingPicker } from "./LastBookingPicker";
import { styles } from "./DateExceptionsSection.styles";

/** How far ahead a date may be planned: the server keeps a year's horizon at most, so the list does too. */
const DATE_WINDOW_DAYS = 365;

export interface DateExceptionsSectionProps {
  dateExceptions: DateExceptionDto[];
  /** Today in the location's own timezone ("YYYY-MM-DD"); earlier entries are not listed. */
  today: string;
  /** The weekday's hours, so a special-hours date starts from what the week already runs. */
  hoursForDay: (isoDay: number) => { open: string; close: string };
  // Callbacks — the parent (RestaurantInfoForm) owns the state.
  onAdd: (entry: DateExceptionDto) => void;
  onRemove: (date: string) => void;
  // Theme values (presentational).
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  cardBg: string;
  textColor: string;
  isDark: boolean;
}

function rowDetail(entry: DateExceptionDto, t: TFunction): string {
  switch (entry.type) {
    case "closed":
      return t("admin.settings.dateExceptions.rowClosed");
    case "walkInOnly":
      return t("admin.settings.dateExceptions.rowWalkInOnly");
    case "specialHours": {
      const hours = t("admin.settings.dateExceptions.rowSpecialHours", {
        open: entry.open,
        close: entry.close,
      });
      return entry.lastBooking
        ? `${hours} · ${t("admin.settings.dateExceptions.rowLastBooking", { time: entry.lastBooking })}`
        : hours;
    }
  }
}

function typeDescription(type: DateExceptionType, t: TFunction): string {
  switch (type) {
    case "closed":
      return t("admin.settings.dateExceptions.closedDescription");
    case "specialHours":
      return t("admin.settings.dateExceptions.specialHoursDescription");
    case "walkInOnly":
      return t("admin.settings.dateExceptions.walkInOnlyDescription");
  }
}

/**
 * The "Dates" section of RestaurantInfoForm: the calendar dates that depart from the weekly
 * hours. Collapsed to one "Add date" button when the list is empty, in the AddRow shape; a row
 * is the date, what happens on it, and Remove. Presentational: the parent owns the list and
 * autosaves it with the rest of the location.
 *
 * Adding a date already listed replaces its entry, which is also the server's rule (a date may
 * appear once), so the list can never hold the duplicate the API would refuse.
 *
 * @see [DateExceptionsSection.test.tsx](../../../tests/components/admin/settings/DateExceptionsSection.test.tsx)
 * — pins that a closed date is added without hours, that special hours carry their own last
 * booking time, and that past dates are not listed.
 */
export function DateExceptionsSection({
  dateExceptions,
  today,
  hoursForDay,
  onAdd,
  onRemove,
  borderColor,
  mutedColor,
  primaryColor,
  cardBg,
  textColor,
  isDark,
}: DateExceptionsSectionProps) {
  const { t } = useTranslation();
  const modeTheme = { borderColor, mutedColor, textColor, isDark };
  const [expanded, setExpanded] = usePersistedState("locations:dates:expanded", true);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState<string>("");
  const [type, setType] = useState<DateExceptionType>("closed");
  const [open, setOpen] = useState("");
  const [close, setClose] = useState("");
  const [lastBooking, setLastBooking] = useState<string | null>(null);

  const upcoming = upcomingDateExceptions({ dateExceptions }, today);
  const subtitle =
    upcoming.length === 0
      ? t("admin.settings.dateExceptions.subtitleEmpty")
      : t("admin.settings.dateExceptions.subtitle", { count: upcoming.length });

  const reset = () => {
    setAdding(false);
    setDate("");
    setType("closed");
    setOpen("");
    setClose("");
    setLastBooking(null);
  };

  const pickDate = (next: string) => {
    setDate(next);
    // Special hours start from the hours that weekday already runs, so the admin edits a
    // difference rather than typing the whole day out.
    const weekly = hoursForDay(getIsoDayFromDateString(next));
    setOpen(weekly.open);
    setClose(weekly.close);
    setLastBooking(null);
  };

  const canAdd = !!date && (type !== "specialHours" || (!!open && !!close));
  const replaces = !!date && dateExceptions.some((e) => e.date === date);

  const submit = () => {
    if (!canAdd) return;
    onAdd(
      type === "specialHours"
        ? { date, type, open, close, lastBooking: lastBooking ?? undefined }
        : { date, type }
    );
    reset();
  };

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon="calendar-outline"
        title={t("admin.settings.dateExceptions.title")}
        subtitle={subtitle}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
            {t("admin.settings.dateExceptions.hint")}
          </ThemedText>

          {upcoming.length > 0 && (
            <View style={styles.list} testID="date-exceptions-list">
              {upcoming.map((entry) => (
                <View
                  key={entry.date}
                  style={[styles.row, { borderBottomColor: borderColor }]}
                  testID={`date-exception-${entry.date}`}
                >
                  <View style={styles.rowCopy}>
                    <ThemedText style={styles.rowDate}>{fmtDateString(entry.date)}</ThemedText>
                    <ThemedText style={[styles.rowDetail, { color: mutedColor }]}>
                      {rowDetail(entry, t)}
                    </ThemedText>
                  </View>
                  <RowTextButton
                    label={t("admin.settings.dateExceptions.removeLabel")}
                    accessibilityLabel={t("admin.settings.dateExceptions.removeDateLabel", {
                      date: fmtDateString(entry.date),
                    })}
                    color={theme.colors.error}
                    testID={`remove-date-exception-${entry.date}`}
                    onPress={() => onRemove(entry.date)}
                  />
                </View>
              ))}
            </View>
          )}

          {!adding ? (
            <ButtonRow align="start">
              <Button
                size="md"
                icon="add"
                onPress={() => setAdding(true)}
                accessibilityLabel={t("admin.settings.dateExceptions.addLabel")}
              >
                {t("admin.settings.dateExceptions.addLabel")}
              </Button>
            </ButtonRow>
          ) : (
            <View style={settingsStyles.addForm} testID="date-exception-form">
              <View style={styles.dateField}>
                <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.dateExceptions.dateLabel")}
                </ThemedText>
                <DatePicker
                  selectedDate={date || undefined}
                  onSelect={pickDate}
                  maxDaysAhead={DATE_WINDOW_DAYS}
                />
                {replaces && (
                  <ThemedText style={[settingsStyles.fieldHint, { color: mutedColor }]}>
                    {t("admin.settings.dateExceptions.replaceHint")}
                  </ThemedText>
                )}
              </View>

              <View style={settingsStyles.policyField}>
                <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.dateExceptions.typeLabel")}
                </ThemedText>
                <View
                  style={[
                    settingsStyles.policyModeGroup,
                    styles.modeGroupStandalone,
                    { backgroundColor: isDark ? "#1b1d1f" : "#eef0f2" },
                  ]}
                >
                  {modeButton(
                    t("admin.settings.dateExceptions.typeClosed"),
                    type === "closed",
                    () => setType("closed"),
                    "date-exception-type-closed",
                    modeTheme
                  )}
                  {modeButton(
                    t("admin.settings.dateExceptions.typeSpecialHours"),
                    type === "specialHours",
                    () => setType("specialHours"),
                    "date-exception-type-special-hours",
                    modeTheme
                  )}
                  {modeButton(
                    t("admin.settings.dateExceptions.typeWalkInOnly"),
                    type === "walkInOnly",
                    () => setType("walkInOnly"),
                    "date-exception-type-walk-in-only",
                    modeTheme
                  )}
                </View>
                <ThemedText style={[styles.typeDescription, { color: mutedColor }]}>
                  {typeDescription(type, t)}
                </ThemedText>
              </View>

              {type === "specialHours" && (
                <View style={styles.fieldGrid}>
                  <View style={styles.gridField}>
                    <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                      {t("admin.settings.dateExceptions.opensLabel")}
                    </ThemedText>
                    <TimePicker
                      selectedTime={open}
                      onSelect={setOpen}
                      minTime="00:00"
                      maxTime="23:45"
                    />
                  </View>
                  <View style={styles.gridField}>
                    <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                      {t("admin.settings.dateExceptions.closesLabel")}
                    </ThemedText>
                    <TimePicker
                      selectedTime={close}
                      onSelect={setClose}
                      minTime="00:00"
                      maxTime="23:45"
                    />
                  </View>
                  <View style={styles.gridField}>
                    <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                      {t("admin.settings.dateExceptions.lastBookingLabel")}
                    </ThemedText>
                    <LastBookingPicker
                      open={open || "00:00"}
                      close={close || "00:00"}
                      value={lastBooking}
                      onChange={setLastBooking}
                      accessibilityLabel={t("admin.settings.dateExceptions.lastBookingLabel")}
                    />
                  </View>
                </View>
              )}

              <ButtonRow>
                <Button
                  variant="secondary"
                  tone="neutral"
                  size="md"
                  onPress={reset}
                  accessibilityLabel={t("admin.settings.dateExceptions.cancelLabel")}
                >
                  {t("common.actions.cancel")}
                </Button>
                <Button
                  size="md"
                  disabled={!canAdd}
                  onPress={submit}
                  accessibilityLabel={t("admin.settings.dateExceptions.addAction")}
                >
                  {t("admin.settings.dateExceptions.addAction")}
                </Button>
              </ButtonRow>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
