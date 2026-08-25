import { RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../common/Button";
import { ThemedText } from "../themed-text";
import { Platform, View, ActivityIndicator, useWindowDimensions } from "react-native";
import { useTableHold } from "./useTableHold";
import HoldStatusBanner from "./HoldStatusBanner";
import PopularTimesPicker from "./PopularTimesPicker";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getNowInTimezone, formatCurrentTimeInTimezone, isViewerInTimezone } from "@/utils/date";
import { isValidEmail } from "@/utils/validation";
import { getHoursForDate } from "@/utils/openingHours";
import { isWalkInOnlyOnDay, isWalkInOnlyOnDate, walkInDaysLabel } from "@/utils/walkIn";
import WalkInNotice from "./WalkInNotice";
import LargePartyNotice from "./LargePartyNotice";
import LargePartyNoticeModal from "./LargePartyNoticeModal";
import { MOBILE_BREAKPOINT } from "@/constants/breakpoints";
import { suggestDate, suggestTime } from "./bookingSuggestions";
import { useBookingAvailability } from "./useBookingAvailability";
import { groupSelectValue, useBookingSeating } from "./useBookingSeating";
import {
  DateField,
  EmailField,
  GuestsField,
  NameField,
  RequestsField,
  SectionField,
  TableField,
  TimeField,
} from "./BookingFormFields";
import {
  BookingFormDrawerLayout,
  BookingFormInlineLayout,
  type BookingFormParts,
} from "./BookingFormLayouts";
import { styles } from "./BookingForm.styles";

const isWeb = Platform.OS === "web";

export interface BookingFormData {
  customerEmail: string;
  customerName: string;
  seats: number;
  /** null when "Any section" is selected (server auto-assigns the table). */
  tableId: number | null;
  /** null when "Any section" is selected. */
  sectionId: number | null;
  /**
   * Combinable-table group id (#274) when the diner selected a combined group; null otherwise.
   * Mutually exclusive with tableId.
   */
  tableGroupId: number | null;
  date: string;
  time: string;
  holdId: string | null;
  specialRequests: string;
}

/** Booking form used inline on a location page or as the body of the booking drawer. */
export type BookingFormLayout = "inline" | "drawer";

export default function BookingForm({
  restaurant,
  onSubmit,
  onRefresh,
  initialTime,
  initialSeats,
  layout = "inline",
  seats: controlledSeats,
  onSeatsChange,
  date: controlledDate,
  onDateChange,
}: {
  restaurant: RestaurantDto;
  onSubmit: (data: BookingFormData) => Promise<void> | void;
  onRefresh?: () => void;
  initialTime?: string;
  initialSeats?: number;
  layout?: BookingFormLayout;
  /** When set, party size is owned by the caller — changing it here reports back up. */
  seats?: number;
  onSeatsChange?: (seats: number) => void;
  /** When set, the date is owned by the caller — changing it here reports back up. */
  date?: string;
  onDateChange?: (date: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, primaryColor: PRIMARY } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDrawer = layout === "drawer";
  const isTwoColumn = isWeb && width >= MOBILE_BREAKPOINT && !isDrawer;

  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [seatsState, setSeats] = useState(initialSeats ?? 2);
  const seats = controlledSeats ?? seatsState;
  const changeSeats = (value: number) => (onSeatsChange ? onSeatsChange(value) : setSeats(value));
  const [submitting, setSubmitting] = useState(false);
  const [seatingOpen, setSeatingOpen] = useState(false);
  const [largePartyNoticeOpen, setLargePartyNoticeOpen] = useState(false);

  const timezone = restaurant.timezone || "UTC";

  const [dateState, setDate] = useState<string>(() => suggestDate(restaurant, timezone));
  const date = controlledDate ?? dateState;
  const changeDate = (value: string) => (onDateChange ? onDateChange(value) : setDate(value));
  const [time, setTime] = useState<string>(() => initialTime ?? suggestTime(restaurant, timezone));

  const openDaysList = restaurant.openDays?.split(",").map(Number) ?? [1, 2, 3, 4, 5, 6, 7];
  const selectedJsDay = date ? new Date(date + "T12:00:00").getDay() : -1;
  const selectedIsoDay = selectedJsDay === 0 ? 7 : selectedJsDay;
  const isClosedDay = date ? !openDaysList.includes(selectedIsoDay) : false;
  const isWalkInDay = date ? isWalkInOnlyOnDate(restaurant, date) : false;
  // Walk-in days stay in the date picker, greyed out and labelled: the location is open on
  // them, so "you can't book, but you can walk in" is the useful thing to say. Dropping them
  // outright also left the picker with nothing to show for a walk-in-only location, and left
  // the trigger unable to name the day the diner was already on.
  const walkInIsoDays = openDaysList.filter((day) => isWalkInOnlyOnDay(restaurant, day));
  const bookingBlocked = isClosedDay || isWalkInDay;

  const [restaurantCurrentTime, setRestaurantCurrentTime] = useState(() =>
    formatCurrentTimeInTimezone(timezone)
  );
  useEffect(() => {
    /* istanbul ignore next */
    const id = setInterval(
      () => setRestaurantCurrentTime(formatCurrentTimeInTimezone(timezone)),
      60_000
    );
    return () => clearInterval(id);
  }, [timezone]);

  const { availabilitySlots, loadingAvailability } = useBookingAvailability({
    restaurant,
    date,
    seats,
    time,
    onTimeCorrected: setTime,
  });

  const currentSlot = availabilitySlots.find((s) => s.time === time);

  const {
    allTables,
    sectionId,
    setSectionId,
    tableId,
    tableGroupId,
    selectSeatingUnit,
    isAutoAssign,
    sectionOptions,
    tableOptions,
    maxTableCapacity,
    partyTooLarge,
  } = useBookingSeating({ restaurant, seats, currentSlot });

  // The seating pick is the only thing that flows between these two hooks, and it flows one way:
  // useTableHold releases or replaces its hold whenever these params change, so nothing has to
  // reach back into it. The call order is therefore pinned by the tableId/isAutoAssign reads
  // below rather than by effect timing — swapping the hooks fails to compile instead of silently
  // changing behaviour.
  const { holdStatus, holdMessage, secondsLeft, holdId, resolvedTableId, setHoldStatus } =
    useTableHold({
      restaurantId: restaurant.id,
      sections: restaurant.sections,
      tableId,
      date,
      time,
      email: customerEmail,
      autoAssign: isAutoAssign,
      seats,
      tableGroupId,
      enabled: !bookingBlocked,
    });

  // When the party size exceeds the largest table, surface the contact-restaurant
  // notice so the user knows why booking is blocked. Re-opens on each over-capacity
  // change (e.g. bumping from one too-big value to another).
  useEffect(() => {
    if (partyTooLarge) setLargePartyNoticeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyTooLarge, maxTableCapacity]);

  const seatOptions = [...Array(10).keys()].map((i) => ({
    label: isDrawer
      ? t("booking.form.partySize", { count: i + 1 })
      : t("booking.form.seatsCount", { count: i + 1 }),
    value: i + 1,
  }));

  const selectedDayHours = getHoursForDate(restaurant, date || getNowInTimezone(timezone).dateStr);
  const minPickerTime = selectedDayHours.open;
  // A close time at or before the open time is a past-midnight service, so the picker runs to
  // the end of the day rather than to a close that reads as earlier than the open.
  const maxPickerTime =
    selectedDayHours.close <= selectedDayHours.open ? "23:45" : selectedDayHours.close;

  const isValid =
    !partyTooLarge &&
    (isAutoAssign || !!tableId || !!tableGroupId) &&
    !!date &&
    !!time &&
    customerName.trim().length > 0 &&
    isValidEmail(customerEmail) &&
    holdStatus === "held" &&
    !bookingBlocked;

  /**
   * Which seating unit the booking reserves. Null table and section ids route the create call
   * into auto-assign, where the server adopts whatever the hold already reserved; a group id
   * routes it into the group branch. The three are mutually exclusive by construction.
   */
  const seatingPayload = () => {
    if (tableGroupId) return { tableId: null, sectionId: null, tableGroupId };
    if (isAutoAssign) return { tableId: null, sectionId: null, tableGroupId: null };
    return { tableId: tableId ?? null, sectionId, tableGroupId: null };
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    const selectedTable = allTables.find((tbl) => tbl.id === tableId);
    if (selectedTable && seats > selectedTable.seats) {
      const confirmed = window.confirm(
        t("booking.form.oversizeConfirm", {
          tableSeats: t("booking.form.seatsCount", { count: selectedTable.seats }),
          guests: t("booking.form.partySize", { count: seats }),
        })
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        customerEmail,
        customerName,
        seats,
        ...seatingPayload(),
        date,
        time,
        holdId,
        specialRequests,
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** Editing the seating choice invalidates a resolved hold, so it drops back to idle. */
  const clearSettledHold = () => {
    if (holdStatus === "held" || holdStatus === "expired") setHoldStatus("idle");
  };

  const holdBanner = (
    <HoldStatusBanner
      holdStatus={holdStatus}
      secondsLeft={secondsLeft}
      hasSelection={(isAutoAssign || !!tableId) && !!date && !!time}
      holdMessage={holdMessage}
      onRefresh={onRefresh}
    />
  );

  const timezoneHint =
    restaurant.timezone && !isViewerInTimezone(timezone) ? (
      <ThemedText
        style={[
          styles.timezoneHint,
          isDrawer && styles.timezoneHintDrawer,
          { color: colors.muted },
        ]}
      >
        {t("booking.form.timezoneHint", {
          timezone: timezone.replace(/_/g, " "),
          time: restaurantCurrentTime,
        })}
      </ThemedText>
    ) : null;

  const guestsField = (label = t("booking.form.guestsLabel")) => (
    <GuestsField label={label} seats={seats} options={seatOptions} onChange={changeSeats} />
  );

  const dateField = (
    <DateField
      date={date}
      openDays={openDaysList}
      walkInDays={walkInIsoDays}
      onChange={changeDate}
    />
  );

  const timePickerField = (label = t("booking.form.timeLabel")) => (
    <TimeField
      label={label}
      time={time}
      minTime={minPickerTime}
      maxTime={maxPickerTime}
      onChange={setTime}
    />
  );

  const sectionField = (
    <SectionField
      sectionId={sectionId}
      options={sectionOptions}
      onChange={(val) => {
        clearSettledHold();
        setSectionId(val);
      }}
    />
  );

  const tableField = (
    <TableField
      isAutoAssign={isAutoAssign}
      resolvedTableId={resolvedTableId}
      options={tableOptions}
      selectedValue={tableGroupId ? groupSelectValue(tableGroupId) : tableId}
      seats={seats}
      mutedColor={colors.muted}
      onChange={(val) => {
        clearSettledHold();
        selectSeatingUnit(val);
      }}
    />
  );

  const nameField = <NameField value={customerName} onChange={setCustomerName} />;
  const emailField = <EmailField value={customerEmail} onChange={setCustomerEmail} />;
  const requestsField = (label: string) => (
    <RequestsField label={label} value={specialRequests} onChange={setSpecialRequests} />
  );

  const gdprText = t("booking.form.gdprText");

  const confirmButton = (
    <Button
      onPress={handleSubmit}
      disabled={!isValid || submitting}
      loading={submitting}
      accessibilityLabel={t("booking.form.confirmBookingLabel")}
    >
      {submitting ? t("booking.form.confirmingLabel") : t("booking.form.confirmLabel")}
    </Button>
  );

  const holdRequiredHint = !submitting &&
    holdStatus !== "held" &&
    (isAutoAssign || tableId) &&
    date &&
    time && (
      <ThemedText
        style={[styles.hint, { color: colors.muted }]}
        role="status"
        accessibilityLiveRegion="polite"
      >
        {t("booking.form.holdRequiredHint")}
      </ThemedText>
    );

  const largePartyModal = (
    <LargePartyNoticeModal
      visible={largePartyNoticeOpen}
      maxCapacity={maxTableCapacity}
      restaurant={restaurant}
      onClose={() => setLargePartyNoticeOpen(false)}
    />
  );

  const largePartyBanner = partyTooLarge && (
    <LargePartyNotice
      maxCapacity={maxTableCapacity}
      onContact={() => setLargePartyNoticeOpen(true)}
    />
  );

  const timesContent = isClosedDay ? (
    <ThemedText style={[styles.closedDayNotice, { color: colors.error }]}>
      {t("booking.form.closedDayNotice")}
    </ThemedText>
  ) : isWalkInDay ? (
    <WalkInNotice scope="day" daysLabel={walkInDaysLabel(restaurant) ?? undefined} />
  ) : (
    <PopularTimesPicker
      slots={availabilitySlots}
      selectedTime={time}
      onSelectTime={setTime}
      selectedDate={date}
      timezone={timezone}
      wrap={isDrawer}
    />
  );

  const timesBlock = (label: string) => (
    <View style={styles.availabilityHeader} aria-busy={loadingAvailability}>
      <View style={styles.availabilityLabelRow}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        {loadingAvailability && (
          <ActivityIndicator
            size="small"
            color={PRIMARY}
            accessibilityLabel={t("booking.form.loadingTimesLabel")}
          />
        )}
      </View>
      {timesContent}
    </View>
  );

  const parts: BookingFormParts = {
    guestsField,
    dateField,
    timePickerField,
    sectionField,
    tableField,
    nameField,
    emailField,
    requestsField,
    timesContent,
    timesBlock,
    timezoneHint,
    largePartyBanner,
    largePartyModal,
    holdBanner,
    holdRequiredHint,
    confirmButton,
    gdprText,
  };

  if (isDrawer) {
    return (
      <BookingFormDrawerLayout
        restaurant={restaurant}
        parts={parts}
        bookingBlocked={bookingBlocked}
        mutedColor={colors.muted}
        primaryColor={PRIMARY}
        borderColor={colors.border}
        loadingAvailability={loadingAvailability}
        seatingOpen={seatingOpen}
        onToggleSeating={() => setSeatingOpen((o) => !o)}
      />
    );
  }

  return (
    <BookingFormInlineLayout
      restaurant={restaurant}
      parts={parts}
      bookingBlocked={bookingBlocked}
      mutedColor={colors.muted}
      isTwoColumn={isTwoColumn}
    />
  );
}
