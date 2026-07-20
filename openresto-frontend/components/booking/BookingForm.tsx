import { RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import DatePicker from "../common/DatePicker";
import TimePicker from "../common/TimePicker";
import { ThemedText } from "../themed-text";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";
import { useTableHold } from "./useTableHold";
import HoldStatusBanner from "./HoldStatusBanner";
import PopularTimesPicker from "./PopularTimesPicker";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getNowInTimezone, formatCurrentTimeInTimezone, isViewerInTimezone } from "@/utils/date";
import { isValidEmail } from "@/utils/validation";
import { getHoursForDate, HoursSource } from "@/utils/openingHours";
import { isWalkInOnlyOnDate, walkInDaysLabel } from "@/utils/walkIn";
import WalkInNotice from "./WalkInNotice";
import WalkInDaysBanner from "./WalkInDaysBanner";

const isWeb = Platform.OS === "web";

export interface BookingFormData {
  customerEmail: string;
  customerName: string;
  seats: number;
  /** null when "Any section" is selected (server auto-assigns the table). */
  tableId: number | null;
  /** null when "Any section" is selected. */
  sectionId: number | null;
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

export default function BookingForm({
  restaurant,
  onSubmit,
  onRefresh,
  initialTime,
  initialSeats,
}: {
  restaurant: RestaurantDto;
  onSubmit: (data: BookingFormData) => Promise<void> | void;
  onRefresh?: () => void;
  initialTime?: string;
  initialSeats?: number;
}) {
  const { colors, primaryColor: PRIMARY } = useAppTheme();
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [seats, setSeats] = useState(initialSeats ?? 2);
  const [submitting, setSubmitting] = useState(false);
  const [sectionId, setSectionId] = useState<number>(0); // 0 = "Any section" (server auto-assigns)

  const allTables = restaurant.sections.flatMap((s) => s.tables);
  // "Any section" is the default option (value 0); concrete sections follow. When selected,
  // the form hides the table dropdown and lets the server pick the best available table.
  const sectionOptions = [
    { label: "Any section", value: 0 },
    ...restaurant.sections.map((s) => ({ label: s.name, value: s.id })),
  ];
  const isAutoAssign = sectionId === 0;
  const tablesInSection = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;

  const timezone = restaurant.timezone || "UTC";

  const [tableId, setTableId] = useState<number | undefined>();
  const [date, setDate] = useState<string>(() => suggestDate(restaurant, timezone));
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
    eligible.sort((a, b) => a.seats - b.seats);
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
      return;
    }
    const candidates = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTableId(
      bestTableFor(seats, availableTableIds.length > 0 ? availableTableIds : undefined, candidates)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // When seats change, release current hold
  useEffect(() => {
    releaseCurrentHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

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

  const tableOptions = eligibleTables.map((table) => ({
    label: `${table.name ?? `Table ${table.id}`} (${table.seats} seats)`,
    value: table.id,
  }));

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
    (isAutoAssign || !!tableId) && // table dropdown hidden for "Any section" — auto-hold still gates
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
        tableId: isAutoAssign ? null : (tableId ?? null),
        sectionId: isAutoAssign ? null : sectionId,
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

  return (
    <View style={styles.form}>
      <WalkInDaysBanner restaurant={restaurant} />
      <View style={styles.availabilityHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ThemedText style={styles.label}>Popular Times</ThemedText>
          {loadingAvailability && <ActivityIndicator size="small" color={PRIMARY} />}
        </View>
        {isClosedDay ? (
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
          />
        )}
      </View>

      {/* Row 1: Guests + Date */}
      <View style={isWeb ? styles.fieldRow : undefined}>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
          <ThemedText style={styles.label}>Number of Guests</ThemedText>
          <Select
            selectedValue={seats}
            onSelect={(v) => setSeats(v as number)}
            options={seatOptions}
          />
        </View>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
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

      {/* Row 2: Time + Section */}
      <View style={isWeb ? styles.fieldRow : undefined}>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
          <ThemedText style={styles.label}>Time</ThemedText>
          <TimePicker
            selectedTime={time}
            onSelect={setTime}
            minTime={minPickerTime}
            maxTime={maxPickerTime}
          />
        </View>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
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
      </View>

      {restaurant.timezone && !isViewerInTimezone(timezone) && (
        <ThemedText style={[styles.timezoneHint, { color: colors.muted }]}>
          All times are in {timezone.replace(/_/g, " ")} (currently {restaurantCurrentTime} there)
        </ThemedText>
      )}

      {/* Row 3: Table + Full Name */}
      <View style={isWeb ? styles.fieldRow : undefined}>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
          <ThemedText style={styles.label}>Table</ThemedText>
          {isAutoAssign ? (
            <ThemedText style={[styles.autoAssignHint, { color: colors.muted }]}>
              We'll seat you at the best available table
              {resolvedTableId ? "" : " across all sections"}.
            </ThemedText>
          ) : eligibleTables.length === 0 ? (
            <ThemedText style={[styles.noTables, { color: colors.error }]}>
              No tables available for {seats} guests.
            </ThemedText>
          ) : (
            <Select
              selectedValue={tableId}
              onSelect={(val) => {
                if (holdStatus === "held" || holdStatus === "expired") {
                  setHoldStatus("idle");
                }
                setTableId(val as number | undefined);
              }}
              options={tableOptions}
              placeholder="Select a table"
            />
          )}
        </View>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
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
      </View>

      {/* Row 4: Email + Special Requests */}
      <View style={isWeb ? [styles.fieldRow, styles.fieldRowStretch] : undefined}>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
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
          <View style={isWeb ? styles.holdPush : undefined}>
            <HoldStatusBanner
              holdStatus={holdStatus}
              secondsLeft={secondsLeft}
              hasSelection={(isAutoAssign || !!tableId) && !!date && !!time}
              holdMessage={holdMessage}
              onRefresh={onRefresh}
            />
          </View>
        </View>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
          <ThemedText style={styles.label}>Special Requests / Allergies</ThemedText>
          <Input
            placeholder="e.g. nut allergy, high chair needed… (optional)"
            value={specialRequests}
            onChangeText={setSpecialRequests}
            multiline
            numberOfLines={3}
            style={styles.textarea}
          />
        </View>
      </View>

      <ThemedText style={styles.gdpr}>
        By confirming, you agree that your email and booking details will be stored to manage your
        reservation. We also use an essential cookie to remember your recent bookings on this
        device. We do not share your data with third parties. You can request deletion by contacting
        the restaurant.
      </ThemedText>

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

      {!submitting && holdStatus !== "held" && (isAutoAssign || tableId) && date && time && (
        <ThemedText style={styles.hint}>A table hold is required before confirming.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  availabilityHeader: {
    width: "100%",
    overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row",
    gap: 16,
  },
  fieldRowStretch: {
    alignItems: "stretch",
  },
  holdPush: {
    marginTop: "auto",
  },
  field: {
    gap: 6,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  noTables: {
    color: "#e53e3e",
    fontSize: 13,
  },
  autoAssignHint: {
    fontSize: 13,
    fontStyle: "italic",
  },
  closedDayNotice: {
    fontSize: 13,
  },
  timezoneHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: -10,
  },
  submitContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  textarea: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  hint: {
    opacity: 0.5,
    fontSize: 12,
    textAlign: "center",
    marginTop: -10,
  },
  gdpr: {
    fontSize: 12,
    opacity: 0.5,
    lineHeight: 18,
  },
});
