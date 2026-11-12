import { RestaurantDto } from "@/api/restaurants";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../common/Button";
import { ThemedText } from "../themed-text";
import { Platform, View, ActivityIndicator, useWindowDimensions } from "react-native";
import { useTableHold } from "./useTableHold";
import HoldStatusBanner from "./HoldStatusBanner";
import { useBookingDock, useHasBookingDock, usePublishBookingDock } from "./BookingDockContext";
import PopularTimesPicker from "./PopularTimesPicker";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getNowInTimezone, formatCurrentTimeInTimezone, isViewerInTimezone } from "@/utils/date";
import { isValidEmail } from "@/utils/validation";
import { groupDisplayName } from "@/utils/tableGroups";
import { confirm } from "@/utils/confirm";
import {
  bookingTimePickerBounds,
  getHoursForDate,
  getLastBookingForDate,
  isOpenOnDate,
} from "@/utils/openingHours";
import { getRestaurantDate } from "@/utils/restaurantTime";
import { isWalkInOnlyOnDay, isWalkInOnlyOnDate, walkInDaysLabel } from "@/utils/walkIn";
import { dateExceptionDates } from "@/utils/dateExceptions";
import {
  clampPartySize,
  isPartyAboveOnlineMax,
  isPartyBelowOnlineMin,
  minOnlinePartySize,
  partySizeOptions,
  pickerDaysAhead,
} from "@/utils/bookingLimits";
import WalkInNotice from "./WalkInNotice";
import LargePartyNotice from "./LargePartyNotice";
import LargePartyNoticeModal from "./LargePartyNoticeModal";
import { MOBILE_BREAKPOINT } from "@/constants/breakpoints";
import { suggestDate, suggestTime } from "./bookingSuggestions";
import { useBookingAvailability } from "./useBookingAvailability";
import { ANY_TABLE_VALUE, groupSelectValue, useBookingSeating } from "./useBookingSeating";
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
  onJoinWaitlist,
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
  /** Offered on the walk-in notice when today is a walk-in day. */
  onJoinWaitlist?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, primaryColor: PRIMARY } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDrawer = layout === "drawer";
  const isTwoColumn = isWeb && width >= MOBILE_BREAKPOINT && !isDrawer;

  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  // A default the location would refuse online is moved inside its range, so the form never
  // opens on a party size the server would turn away.
  const [seatsState, setSeats] = useState(() => clampPartySize(restaurant, initialSeats ?? 2));
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
  // Judged as a date, not a weekday: a closed date exception shuts an open weekday and a
  // special-hours date opens a closed one, the same way the server reads them.
  const isClosedDay = date ? !isOpenOnDate(restaurant, date) : false;
  const isWalkInDay = date ? isWalkInOnlyOnDate(restaurant, date) : false;
  const closedDates = dateExceptionDates(restaurant, "closed");
  const specialHoursDates = dateExceptionDates(restaurant, "specialHours");
  const walkInDates = dateExceptionDates(restaurant, "walkInOnly");
  // Walk-in days stay in the date picker, greyed out and labelled: the location is open on
  // them, so "you can't book, but you can walk in" is the useful thing to say. Dropping them
  // outright also left the picker with nothing to show for a walk-in-only location, and left
  // the trigger unable to name the day the diner was already on.
  const walkInIsoDays = openDaysList.filter((day) => isWalkInOnlyOnDay(restaurant, day));
  const bookingBlocked = isClosedDay || isWalkInDay;
  // The online party size limits (#522): over the cap the guest is pointed at the phone, like
  // a party no table seats; under the floor they are told to come in.
  const partyAboveOnlineMax = isPartyAboveOnlineMax(restaurant, seats);
  const partyBelowOnlineMin = isPartyBelowOnlineMin(restaurant, seats);
  const partyOutsideOnlineRange = partyAboveOnlineMax || partyBelowOnlineMin;

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
    allGroups,
    sectionId,
    selectSection,
    tableId,
    tableGroupId,
    selectSeatingUnit,
    isAnySection,
    isAutoAssign,
    autoAssignSectionId,
    canChooseTable,
    sectionOptions,
    tableOptions,
    hasEligibleUnits,
    maxTableCapacity,
    partyTooLarge,
  } = useBookingSeating({ restaurant, seats, currentSlot });

  // The seating pick is the only thing that flows between these two hooks, and it flows one way:
  // useTableHold releases or replaces its hold whenever these params change, so nothing has to
  // reach back into it. The call order is therefore pinned by the tableId/isAutoAssign reads
  // below rather than by effect timing — swapping the hooks fails to compile instead of silently
  // changing behaviour.
  const {
    holdStatus,
    holdMessage,
    secondsLeft,
    holdId,
    resolvedTableId,
    resolvedGroupId,
    setHoldStatus,
  } = useTableHold({
    restaurantId: restaurant.id,
    sections: restaurant.sections,
    tableId,
    date,
    time,
    email: customerEmail,
    autoAssign: isAutoAssign,
    autoAssignSectionId,
    seats,
    tableGroupId,
    enabled: !bookingBlocked && !partyOutsideOnlineRange,
  });

  /**
   * What the banner names as held. An auto-assigned or group hold is only known once the server
   * answers, so its resolved ids win over the form's own pick.
   */
  const heldGroup = allGroups.find((g) => g.id === (resolvedGroupId ?? tableGroupId));
  const heldTable = allTables.find((tbl) => tbl.id === (resolvedTableId ?? tableId));
  const heldTableName = heldGroup
    ? groupDisplayName(heldGroup)
    : heldTable
      ? (heldTable.name ?? t("booking.seating.tableFallbackName", { id: heldTable.id }))
      : null;

  // When the party size exceeds the largest table or the online cap, surface the
  // contact-restaurant notice so the user knows why booking is blocked. Re-opens on each
  // over-capacity change (e.g. bumping from one too-big value to another).
  const partyNeedsContact = partyTooLarge || partyAboveOnlineMax;
  useEffect(() => {
    if (partyNeedsContact) setLargePartyNoticeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyNeedsContact, maxTableCapacity]);

  /**
   * The online maximum is the tighter of the two when both apply: a location whose tables seat
   * twelve but takes eight online says eight, and a location with no online cap says its tables.
   */
  const largePartyReason = partyAboveOnlineMax ? "onlineMax" : "capacity";
  const largePartyMax = partyAboveOnlineMax ? restaurant.maxOnlinePartySize! : maxTableCapacity;

  // The list runs the location's online range, with one entry past the cap so a bigger party
  // can say so and be pointed at the phone rather than finding its number missing.
  const seatOptions = partySizeOptions(restaurant).map((size) => ({
    label: isPartyAboveOnlineMax(restaurant, size)
      ? t("booking.form.partySizeMore", { count: size })
      : isDrawer
        ? t("booking.form.partySize", { count: size })
        : t("booking.form.seatsCount", { count: size }),
    value: size,
  }));

  const selectedDate = date || getNowInTimezone(timezone).dateStr;
  const { min: minPickerTime, max: maxPickerTime } = bookingTimePickerBounds({
    ...getHoursForDate(restaurant, selectedDate),
    lastBooking: getLastBookingForDate(restaurant, selectedDate),
  });

  const isValid =
    !partyTooLarge &&
    !partyOutsideOnlineRange &&
    (isAutoAssign || !!tableId || !!tableGroupId) &&
    !!date &&
    !!time &&
    customerName.trim().length > 0 &&
    isValidEmail(customerEmail) &&
    holdStatus === "held" &&
    !bookingBlocked;

  /**
   * Which seating unit the booking reserves. A null table id routes the create call into
   * auto-assign, where the server adopts whatever the hold already reserved; a group id routes it
   * into the group branch. The three are mutually exclusive by construction.
   */
  const seatingPayload = () => {
    if (tableGroupId) return { tableId: null, sectionId: null, tableGroupId };
    if (isAutoAssign) {
      return { tableId: null, sectionId: autoAssignSectionId ?? null, tableGroupId: null };
    }
    return { tableId: tableId ?? null, sectionId, tableGroupId: null };
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    const selectedTable = allTables.find((tbl) => tbl.id === tableId);
    if (selectedTable && seats > selectedTable.seats) {
      const confirmed = await confirm(
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

  /**
   * The docked confirm lives outside this form, in the sheet that hosts it, so what it presses
   * has to survive the form re-rendering under it — hence the ref rather than `handleSubmit`
   * itself, whose identity changes on every keystroke.
   */
  const submitRef = useRef(handleSubmit);
  useEffect(() => {
    submitRef.current = handleSubmit;
  });
  const dockedSubmit = useCallback(() => {
    void submitRef.current();
  }, []);

  /**
   * A name and an email are what the guest has to type either way, and entering them is also
   * what takes the hold — so the confirm arrives docked at the same moment the table is held,
   * and the sheet keeps its full height while they are still choosing a time.
   */
  const hasDock = useHasBookingDock();
  const shouldDock = hasDock && customerName.trim().length > 0 && isValidEmail(customerEmail);

  usePublishBookingDock(
    shouldDock
      ? {
          holdStatus,
          secondsLeft,
          hasSelection: (isAutoAssign || !!tableId) && !!date && !!time,
          holdMessage,
          heldTableName,
          disabled: !isValid || submitting,
          submitting,
          onSubmit: dockedSubmit,
          onRefresh,
        }
      : null
  );

  /**
   * What the footer is actually showing, not what this render thinks it should show. The
   * publish lands in an effect, so the footer arrives one commit later — dropping the inline
   * confirm on the earlier commit leaves a frame with neither, and the scroll shifts under the
   * guest's thumb as they finish typing their email and then shifts back.
   */
  const docked = useBookingDock() !== null;

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
      tableName={heldTableName}
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
      closedDates={closedDates}
      openDates={specialHoursDates}
      walkInDates={walkInDates}
      maxDaysAhead={pickerDaysAhead(restaurant)}
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
        selectSection(val);
      }}
    />
  );

  const tableField = (
    <TableField
      canChooseTable={canChooseTable}
      isAnySection={isAnySection}
      hasEligibleUnits={hasEligibleUnits}
      resolvedTableId={resolvedTableId}
      options={tableOptions}
      selectedValue={tableGroupId ? groupSelectValue(tableGroupId) : (tableId ?? ANY_TABLE_VALUE)}
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
      maxCapacity={largePartyMax}
      reason={largePartyReason}
      restaurant={restaurant}
      onClose={() => setLargePartyNoticeOpen(false)}
    />
  );

  const largePartyBanner = partyNeedsContact && (
    <LargePartyNotice
      maxCapacity={largePartyMax}
      reason={largePartyReason}
      onContact={() => setLargePartyNoticeOpen(true)}
    />
  );

  const timesContent = isClosedDay ? (
    <ThemedText style={[styles.closedDayNotice, { color: colors.error }]}>
      {t("booking.form.closedDayNotice")}
    </ThemedText>
  ) : partyBelowOnlineMin ? (
    <ThemedText
      style={[styles.closedDayNotice, { color: colors.muted }]}
      testID="party-below-min-notice"
    >
      {t("booking.form.partyBelowMinNotice", { min: minOnlinePartySize(restaurant) })}
    </ThemedText>
  ) : isWalkInDay ? (
    <WalkInNotice
      scope="day"
      daysLabel={walkInDaysLabel(restaurant) ?? undefined}
      onJoinWaitlist={date === getRestaurantDate(timezone) ? onJoinWaitlist : undefined}
    />
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
    // Docked, these three are rendered by the sheet's footer instead. Leaving them here as
    // well would put a second Confirm in the scroll behind the first.
    holdBanner: docked ? null : holdBanner,
    holdRequiredHint: docked ? null : holdRequiredHint,
    confirmButton: docked ? null : confirmButton,
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
