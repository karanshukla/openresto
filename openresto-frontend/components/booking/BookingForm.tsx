import { RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import DatePicker from "../common/DatePicker";
import TimePicker from "../common/TimePicker";
import { ThemedText } from "../themed-text";
import { Platform, Pressable, View, ActivityIndicator, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTableHold } from "./useTableHold";
import HoldStatusBanner from "./HoldStatusBanner";
import PopularTimesPicker from "./PopularTimesPicker";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getNowInTimezone, formatCurrentTimeInTimezone, isViewerInTimezone } from "@/utils/date";
import { isValidEmail } from "@/utils/validation";
import { getHoursForDate, HoursSource } from "@/utils/openingHours";
import { isWalkInOnlyOnDate, walkInDaysLabel } from "@/utils/walkIn";
import { groupDropdownLabel, groupedTableIds } from "@/utils/tableGroups";
import WalkInNotice from "./WalkInNotice";
import WalkInDaysBanner from "./WalkInDaysBanner";
import LargePartyNotice from "./LargePartyNotice";
import LargePartyNoticeModal from "./LargePartyNoticeModal";
import { MOBILE_BREAKPOINT } from "@/constants/breakpoints";
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

// ── Auto-suggestion helpers ──────────────────────────────────────────────────

/* istanbul ignore next */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split("T")[0];
}

function suggestDate(restaurant: HoursSource, timezone: string): string {
  const { dateStr, hours, minutes } = getNowInTimezone(timezone);
  const { close } = getHoursForDate(restaurant, dateStr);
  const [closeH] = close.split(":").map(Number);
  const latestStartMinutes = (closeH - 1) * 60 + 45;
  if (hours * 60 + minutes < latestStartMinutes) {
    return dateStr;
  }
  /* istanbul ignore next */
  return addDays(dateStr, 1);
}

function suggestTime(restaurant: HoursSource, timezone: string): string {
  const { dateStr, hours, minutes } = getNowInTimezone(timezone);
  const { open: openTime, close: closeTime } = getHoursForDate(restaurant, dateStr);
  let h = hours;
  const m = minutes < 15 ? 15 : minutes < 30 ? 30 : minutes < 45 ? 45 : 0;
  if (m === 0) h += 1;

  const [openH] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const closeTotal = closeH * 60 + closeM;
  const currentTotal = h * 60 + m;

  /* istanbul ignore next */
  if (currentTotal < openH * 60 || currentTotal > closeTotal) {
    return `${(openH + 1).toString().padStart(2, "0")}:00`;
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * `inline` is the full form: it owns party size and date and lays fields out in pairs.
 * `drawer` is the booking-drawer variant, where party size and date have already been
 * chosen on the page-level filter bar and are passed in — leaving the drawer to ask
 * only what the list can't: which time, who, and how to reach them.
 */
export type BookingFormLayout = "inline" | "drawer";

export default function BookingForm({
  restaurant,
  onSubmit,
  onRefresh,
  initialTime,
  initialSeats,
  layout = "inline",
  seats: controlledSeats,
  date: controlledDate,
}: {
  restaurant: RestaurantDto;
  onSubmit: (data: BookingFormData) => Promise<void> | void;
  onRefresh?: () => void;
  initialTime?: string;
  initialSeats?: number;
  layout?: BookingFormLayout;
  /** When set, party size is owned by the caller and its picker is not rendered. */
  seats?: number;
  /** When set, the date is owned by the caller and its picker is not rendered. */
  date?: string;
}) {
  const { colors, primaryColor: PRIMARY } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDrawer = layout === "drawer";
  const isTwoColumn = isWeb && width >= MOBILE_BREAKPOINT && !isDrawer;
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [seatsState, setSeats] = useState(initialSeats ?? 2);
  const seats = controlledSeats ?? seatsState;
  const [submitting, setSubmitting] = useState(false);
  const [seatingOpen, setSeatingOpen] = useState(false);
  const [sectionId, setSectionId] = useState<number>(0); // 0 = "Any section" (server auto-assigns)

  const allTables = restaurant.sections.flatMap((s) => s.tables);
  const allGroups = restaurant.groups ?? [];
  // Tables flagged combinable. They stay individually bookable (#242) — this only deprioritizes
  // them in the suggested-table pick below.
  const groupedTableIdSet = groupedTableIds(allGroups);
  // Largest capacity at this location — the best single table OR the best combinable group (#274).
  // Parties above this can't be seated even with pushed-together tables and must contact the
  // restaurant directly. Computed client-side from the nested restaurant payload — no extra fetch.
  const maxSingleTableSeats = allTables.length > 0 ? Math.max(...allTables.map((t) => t.seats)) : 0;
  const maxGroupSeats =
    allGroups.length > 0 ? Math.max(...allGroups.map((g) => g.combinedSeats)) : 0;
  const maxTableCapacity = Math.max(maxSingleTableSeats, maxGroupSeats);
  const partyTooLarge = maxTableCapacity > 0 && seats > maxTableCapacity;
  const [largePartyNoticeOpen, setLargePartyNoticeOpen] = useState(false);
  // "Any section" is the default option (value 0); concrete sections follow. When selected,
  // the form hides the table dropdown and lets the server pick the best available table.
  const sectionOptions = [
    { label: "Any section", value: 0 },
    ...restaurant.sections.map((s) => ({ label: s.name, value: s.id })),
  ];
  const isAutoAssign = sectionId === 0;
  const tablesInSection = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
  // Groups belong to the picked section only when *every* member sits in it — booking a group is
  // booking all its tables, so one member elsewhere means the party would be split across sections.
  // TableDto carries no sectionId, so membership is resolved through the section's own table ids.
  const sectionTableIds = new Set(tablesInSection.map((t) => t.id));
  const groupsInSection = isAutoAssign
    ? allGroups
    : allGroups.filter(
        (g) => g.members.length > 0 && g.members.every((m) => sectionTableIds.has(m.id))
      );

  const timezone = restaurant.timezone || "UTC";

  const [tableId, setTableId] = useState<number | undefined>();
  // Combinable-group selection (#274): when set, the diner picked a combined-table group from the
  // dropdown instead of a single table. Mutually exclusive with tableId in the submit payload.
  const [tableGroupId, setTableGroupId] = useState<number | undefined>();
  const [dateState, setDate] = useState<string>(() => suggestDate(restaurant, timezone));
  const date = controlledDate ?? dateState;
  const [time, setTime] = useState<string>(() => initialTime ?? suggestTime(restaurant, timezone));

  const [availabilitySlots, setAvailabilitySlots] = useState<TimeSlotDto[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

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

  const currentSlot = availabilitySlots.find((s) => s.time === time);
  const availableTableIds = currentSlot?.availableTableIds ?? [];
  const availableGroupIds = currentSlot?.availableGroupIds ?? [];

  function bestTableFor(
    seatCount: number,
    availableIds?: number[],
    candidateTables?: typeof allTables
  ) {
    const pool = candidateTables ?? allTables;
    // Lower bound: table must seat the party. Upper bound: when the restaurant caps spare
    // seats, drop tables too large for the group. Mirrors the server-side eligible-table
    // filter (AvailabilityService) so the auto-suggested pick is always one the API accepts.
    let eligible = pool.filter(
      (t) =>
        t.seats >= seatCount &&
        (restaurant.maxTableOversizeSeats == null ||
          t.seats <= seatCount + restaurant.maxTableOversizeSeats)
    );
    if (availableIds && availableIds.length > 0) {
      eligible = eligible.filter((t) => availableIds.includes(t.id));
    }
    // Smallest fitting table, but a combinable table loses to an ungrouped one of the same size —
    // the same deprioritization the server applies when auto-assigning, so the suggested default
    // leaves the mergeable tables free for the parties that need them pushed together.
    eligible.sort((a, b) => {
      if (a.seats !== b.seats) return a.seats - b.seats;
      return Number(groupedTableIdSet.has(a.id)) - Number(groupedTableIdSet.has(b.id));
    });
    return eligible[0]?.id ?? pool[0]?.id;
  }

  const {
    holdStatus,
    holdMessage,
    secondsLeft,
    holdId,
    resolvedTableId,
    setHoldStatus,
    releaseCurrentHold,
  } = useTableHold({
    restaurantId: restaurant.id,
    sections: restaurant.sections,
    tableId,
    date,
    time,
    email: customerEmail,
    autoAssign: isAutoAssign,
    seats,
    tableGroupId,
  });

  // Fetch availability when date/seats change
  useEffect(() => {
    const openDaysList = restaurant.openDays?.split(",").map(Number) ?? [1, 2, 3, 4, 5, 6, 7];
    const jsDay = date ? new Date(date + "T12:00:00").getDay() : -1;
    const isoDay = jsDay === 0 ? 7 : jsDay;
    if (date && (!openDaysList.includes(isoDay) || isWalkInOnlyOnDate(restaurant, date))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailabilitySlots([]);
      setLoadingAvailability(false);
      return;
    }
    async function loadAvailability() {
      setLoadingAvailability(true);
      try {
        const res = await fetchAvailability(restaurant.id, date, seats);
        if (res && res.slots) {
          setAvailabilitySlots(res.slots);
          // If current time is not in available slots, pick the first available one
          const isCurrentValid = res.slots.find((s) => s.time === time && s.isAvailable);
          if (!isCurrentValid) {
            const firstAvail = res.slots.find((s) => s.isAvailable);
            if (firstAvail) {
              setTime(firstAvail.time);
            }
          }
        } else {
          setAvailabilitySlots([]);
        }
      } finally {
        setLoadingAvailability(false);
      }
    }
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, seats, restaurant.id]);

  // When availability or time changes, ensure we have a valid table selected.
  // Skipped in auto-assign mode — the server picks the table, so we don't pre-select one here.
  useEffect(() => {
    if (isAutoAssign) {
      if (tableId !== undefined) setTableId(undefined);
      if (tableGroupId !== undefined) setTableGroupId(undefined);
      return;
    }
    const candidates = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
    if (availableTableIds.length > 0) {
      if (!tableId || !availableTableIds.includes(tableId)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTableId(bestTableFor(seats, availableTableIds, candidates));
      }
    } else {
      setTableId(bestTableFor(seats, undefined, candidates));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTableIds, seats, isAutoAssign]);

  // When section changes, release hold and pick best table in new section (or clear the
  // table selection when switching into "Any section" auto-assign mode).
  useEffect(() => {
    releaseCurrentHold();
    if (isAutoAssign) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTableId(undefined);
      setTableGroupId(undefined);
      return;
    }
    const candidates = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTableId(
      bestTableFor(seats, availableTableIds.length > 0 ? availableTableIds : undefined, candidates)
    );
    setTableGroupId(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // When seats change, release current hold
  useEffect(() => {
    releaseCurrentHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

  // When the party size exceeds the largest table, surface the contact-restaurant
  // notice so the user knows why booking is blocked. Re-opens on each over-capacity
  // change (e.g. bumping from one too-big value to another).
  useEffect(() => {
    if (partyTooLarge) setLargePartyNoticeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyTooLarge, maxTableCapacity]);

  // ── Options ──────────────────────────────────────────────────────────────────

  const seatOptions = [...Array(10).keys()].map((i) => ({
    label: `${i + 1} seat${i > 0 ? "s" : ""}`,
    value: i + 1,
  }));

  const eligibleTables = tablesInSection
    .filter(
      (t) =>
        t.seats >= seats &&
        (restaurant.maxTableOversizeSeats == null ||
          t.seats <= seats + restaurant.maxTableOversizeSeats)
    )
    .filter((t) => {
      // Strictly filter only if we have availability data for the selected time
      if (currentSlot) {
        return availableTableIds.includes(t.id);
      }
      return true;
    })
    .sort((a, b) => a.seats - b.seats);

  // Combinable groups (#274): a group is selectable when it sits in the picked section, its combined
  // capacity fits the party, it respects the optional oversize cap, and (when availability data is
  // present) the group's id is in the slot's availableGroupIds. Groups use negative Select values
  // (-groupId) so they're distinguishable from positive table ids.
  const eligibleGroups = groupsInSection
    .filter(
      (g) =>
        g.combinedSeats >= seats &&
        (restaurant.maxTableOversizeSeats == null ||
          g.combinedSeats <= seats + restaurant.maxTableOversizeSeats)
    )
    .filter((g) => (currentSlot ? availableGroupIds.includes(g.id) : true))
    .sort((a, b) => a.combinedSeats - b.combinedSeats);

  const tableOptions = [
    ...eligibleTables.map((table) => ({
      label: `${table.name ?? `Table ${table.id}`} (${table.seats} seats)`,
      value: table.id,
    })),
    ...eligibleGroups.map((g) => ({ label: groupDropdownLabel(g), value: -g.id })),
  ];

  // ── Submit ───────────────────────────────────────────────────────────────────

  const openDaysList = restaurant.openDays?.split(",").map(Number) ?? [1, 2, 3, 4, 5, 6, 7];
  const selectedJsDay = date ? new Date(date + "T12:00:00").getDay() : -1;
  const selectedIsoDay = selectedJsDay === 0 ? 7 : selectedJsDay;
  const isClosedDay = date ? !openDaysList.includes(selectedIsoDay) : false;
  const isWalkInDay = date ? isWalkInOnlyOnDate(restaurant, date) : false;

  // Hours for the selected date's day of week (falls back to uniform hours).
  // For after-midnight closing (close <= open) let the picker run to end of day.
  const selectedDayHours = getHoursForDate(restaurant, date || getNowInTimezone(timezone).dateStr);
  const minPickerTime = selectedDayHours.open;
  const maxPickerTime =
    selectedDayHours.close <= selectedDayHours.open ? "23:45" : selectedDayHours.close;

  const isValid =
    !partyTooLarge && // block large parties — no single table or group can seat them
    (isAutoAssign || !!tableId || !!tableGroupId) && // auto-assign, a table, or a group is selected
    !!date &&
    !!time &&
    customerName.trim().length > 0 &&
    isValidEmail(customerEmail) &&
    holdStatus === "held" &&
    !isClosedDay &&
    !isWalkInDay;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    const selectedTable = allTables.find((t) => t.id === tableId);
    if (selectedTable && seats > selectedTable.seats) {
      const confirmed = window.confirm(
        `Warning: This table only has ${selectedTable.seats} seats, but you are booking for ${seats} guests. Do you want to continue?`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        customerEmail,
        customerName,
        seats,
        // For "Any section", defer table selection to the server (null ids trigger auto-assign
        // on the booking create path; the server will adopt the held table from the hold id).
        // For a combinable group selection, send the group id + null table so the booking-create
        // path routes into the group-booking branch.
        tableId: isAutoAssign || tableGroupId ? null : (tableId ?? null),
        sectionId: isAutoAssign || tableGroupId ? null : sectionId,
        tableGroupId: tableGroupId ?? null,
        date,
        time,
        holdId,
        specialRequests,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

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
        All times are in {timezone.replace(/_/g, " ")} (currently {restaurantCurrentTime} there)
      </ThemedText>
    ) : null;

  const timePickerField = (label = "Time") => (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TimePicker
        selectedTime={time}
        onSelect={setTime}
        minTime={minPickerTime}
        maxTime={maxPickerTime}
      />
    </View>
  );

  const sectionField = (
    <View style={styles.field}>
      <ThemedText style={styles.label}>Section</ThemedText>
      <Select
        selectedValue={sectionId}
        onSelect={(val) => {
          if (holdStatus === "held" || holdStatus === "expired") {
            setHoldStatus("idle");
          }
          setSectionId(val as number);
        }}
        options={sectionOptions}
        placeholder="Select a section"
      />
    </View>
  );

  const tableField = (
    <View style={styles.field}>
      <ThemedText style={styles.label}>Table</ThemedText>
      {isAutoAssign ? (
        <ThemedText style={[styles.autoAssignHint, { color: colors.muted }]}>
          We'll seat you at the best available table
          {resolvedTableId ? "" : " across all sections"}.
        </ThemedText>
      ) : tableOptions.length === 0 ? (
        <ThemedText style={[styles.noTables, { color: colors.muted }]}>
          No tables available for {seats} guests.
        </ThemedText>
      ) : (
        <Select
          // A group selection is encoded as a negative value (-groupId); a table as its id.
          selectedValue={tableGroupId ? -tableGroupId : tableId}
          onSelect={(val) => {
            if (holdStatus === "held" || holdStatus === "expired") {
              setHoldStatus("idle");
            }
            const v = val as number;
            if (v < 0) {
              // Group selected — clear any single-table selection.
              setTableGroupId(-v);
              setTableId(undefined);
            } else {
              // Single table selected — clear any group selection.
              setTableGroupId(undefined);
              setTableId(v);
            }
          }}
          options={tableOptions}
          placeholder="Select a table"
        />
      )}
    </View>
  );

  const nameField = (
    <View style={styles.field}>
      <ThemedText style={styles.label}>Full Name</ThemedText>
      <Input
        placeholder="Your full name"
        value={customerName}
        onChangeText={setCustomerName}
        autoCapitalize="words"
        returnKeyType="next"
        blurOnSubmit={false}
      />
    </View>
  );

  const emailField = (
    <View style={styles.field}>
      <ThemedText style={styles.label}>Email</ThemedText>
      <Input
        placeholder="your@email.com"
        value={customerEmail}
        onChangeText={setCustomerEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        blurOnSubmit={false}
      />
    </View>
  );

  const requestsField = (label: string) => (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Input
        placeholder="e.g. nut allergy, high chair needed… (optional)"
        value={specialRequests}
        onChangeText={setSpecialRequests}
        multiline
        numberOfLines={3}
        style={styles.textarea}
      />
    </View>
  );

  const gdprText = `By confirming, you agree that your email and booking details will be stored to manage your reservation. We also use an essential cookie to remember your recent bookings on this device. We do not share your data with third parties. You can request deletion by contacting the restaurant.`;

  const confirmButton = (
    <Button onPress={handleSubmit} disabled={!isValid || submitting}>
      {submitting ? (
        <View style={styles.submitContent}>
          <ActivityIndicator size="small" color="#fff" />
          <ThemedText style={styles.submitText}>Confirming…</ThemedText>
        </View>
      ) : (
        "Confirm Booking"
      )}
    </Button>
  );

  const holdRequiredHint = !submitting &&
    holdStatus !== "held" &&
    (isAutoAssign || tableId) &&
    date &&
    time && (
      <ThemedText style={styles.hint}>A table hold is required before confirming.</ThemedText>
    );

  const largePartyModal = (
    <LargePartyNoticeModal
      visible={largePartyNoticeOpen}
      maxCapacity={maxTableCapacity}
      restaurant={restaurant}
      onClose={() => setLargePartyNoticeOpen(false)}
    />
  );

  const timesContent = isClosedDay ? (
    <ThemedText style={[styles.closedDayNotice, { color: colors.error }]}>
      The restaurant is closed on this day. Please select a different date.
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
    <View style={styles.availabilityHeader}>
      <View style={styles.availabilityLabelRow}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        {loadingAvailability && <ActivityIndicator size="small" color={PRIMARY} />}
      </View>
      {timesContent}
    </View>
  );

  const sectionHeading = (label: string, busy = false) => (
    <View style={styles.sectionHeadingRow}>
      <ThemedText style={[styles.sectionHeading, { color: colors.muted }]}>{label}</ThemedText>
      {busy && <ActivityIndicator size="small" color={PRIMARY} />}
    </View>
  );

  const divider = <View style={[styles.divider, { backgroundColor: colors.border }]} />;

  // ── Drawer layout ──
  // Party size and date are already settled by the page-level bar, so the drawer asks
  // only for the time, the diner, and (behind a disclosure) a specific seat.
  if (isDrawer) {
    return (
      <View style={styles.drawerForm}>
        <WalkInDaysBanner restaurant={restaurant} />

        <View style={styles.drawerSection}>
          {sectionHeading("Time", loadingAvailability)}
          {timesContent}
          {/* Right under the times it qualifies, not buried in the footer. */}
          {timezoneHint}
          {holdBanner}
          {partyTooLarge && (
            <LargePartyNotice
              maxCapacity={maxTableCapacity}
              onContact={() => setLargePartyNoticeOpen(true)}
            />
          )}
        </View>

        {divider}

        <View style={styles.drawerSection}>
          {sectionHeading("Your details")}
          {nameField}
          {emailField}
          {requestsField("Special requests / allergies")}
        </View>

        {divider}

        {/* Seating is the one optional step, so it reads as a single closed control rather
            than a bare text link floating between the fields above and the footer below. */}
        <View style={styles.drawerSection}>
          <Pressable
            testID="seating-disclosure-toggle"
            onPress={() => {
              Haptics.selectionAsync();
              setSeatingOpen((o) => !o);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: seatingOpen }}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.disclosureToggle,
              {
                backgroundColor: colors.input,
                borderColor: hovered || pressed ? PRIMARY : colors.border,
              },
            ]}
          >
            <Ionicons name="options-outline" size={16} color={colors.muted} />
            <ThemedText style={styles.disclosureText}>Choose a section or table</ThemedText>
            <Ionicons
              name={seatingOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.muted}
            />
          </Pressable>
          {seatingOpen && (
            <View style={[styles.disclosureBody, { borderColor: colors.border }]}>
              {/* Labelled "Exact time" because the chips above are already "Time" — this one
                  reaches times the availability list doesn't offer. */}
              {timePickerField("Exact time")}
              {sectionField}
              {tableField}
            </View>
          )}
        </View>

        {divider}

        <View style={styles.drawerFooter}>
          <ThemedText style={styles.gdpr}>{gdprText}</ThemedText>
          {confirmButton}
          {holdRequiredHint}
        </View>
        {largePartyModal}
      </View>
    );
  }

  const half = isTwoColumn ? styles.fieldHalf : undefined;

  return (
    <View style={styles.form}>
      <WalkInDaysBanner restaurant={restaurant} />
      {timesBlock("Popular Times")}

      {/* Row 1: Guests + Date */}
      <View
        testID="booking-field-row"
        style={isTwoColumn ? styles.fieldRow : styles.fieldRowStacked}
      >
        <View style={[styles.field, half]}>
          <ThemedText style={styles.label}>Number of Guests</ThemedText>
          <Select
            selectedValue={seats}
            onSelect={(v) => setSeats(v as number)}
            options={seatOptions}
          />
        </View>
        <View style={[styles.field, half]}>
          <ThemedText style={styles.label}>Date</ThemedText>
          {/* Customer flow: future-dates-only is intentional. Do NOT pass allowPast
              here — only the admin New Booking modal opts in to back-dating (#160). */}
          <DatePicker
            selectedDate={date}
            onSelect={setDate}
            openDays={restaurant.openDays?.split(",").map(Number)}
          />
        </View>
      </View>

      {partyTooLarge && (
        <LargePartyNotice
          maxCapacity={maxTableCapacity}
          onContact={() => setLargePartyNoticeOpen(true)}
        />
      )}

      {/* Row 2: Time + Section */}
      <View
        testID="booking-field-row"
        style={isTwoColumn ? styles.fieldRow : styles.fieldRowStacked}
      >
        <View style={half}>{timePickerField()}</View>
        <View style={half}>{sectionField}</View>
      </View>

      {timezoneHint}

      {/* Row 3: Table + Full Name */}
      <View
        testID="booking-field-row"
        style={isTwoColumn ? styles.fieldRow : styles.fieldRowStacked}
      >
        <View style={half}>{tableField}</View>
        <View style={half}>{nameField}</View>
      </View>

      {/* Row 4: Email + Special Requests. Stacked, each gets its own full-width row and the
          hold banner moves out to sit directly above the confirm button. */}
      <View
        testID="booking-field-row"
        style={isTwoColumn ? [styles.fieldRow, styles.fieldRowStretch] : styles.fieldRowStacked}
      >
        <View style={[styles.field, half]}>
          {emailField}
          {isTwoColumn && <View style={styles.holdPush}>{holdBanner}</View>}
        </View>
        <View style={half}>{requestsField("Special Requests / Allergies")}</View>
      </View>

      {!isTwoColumn && holdBanner}

      <ThemedText style={styles.gdpr}>{gdprText}</ThemedText>

      {confirmButton}
      {holdRequiredHint}
      {largePartyModal}
    </View>
  );
}
