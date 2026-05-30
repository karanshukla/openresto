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
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { getNowInTimezone, formatCurrentTimeInTimezone } from "@/utils/date";

const isWeb = Platform.OS === "web";

export interface BookingFormData {
  customerEmail: string;
  customerName: string;
  seats: number;
  tableId: number;
  sectionId: number;
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

function suggestDate(closeTime: string, timezone: string): string {
  const { dateStr, hours, minutes } = getNowInTimezone(timezone);
  const [closeH] = closeTime.split(":").map(Number);
  const latestStartMinutes = (closeH - 1) * 60 + 45;
  if (hours * 60 + minutes < latestStartMinutes) {
    return dateStr;
  }
  /* istanbul ignore next */
  return addDays(dateStr, 1);
}

function suggestTime(openTime: string, closeTime: string, timezone: string): string {
  const { hours, minutes } = getNowInTimezone(timezone);
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
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const PRIMARY = brand.primaryColor || COLORS.primary;
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [seats, setSeats] = useState(initialSeats ?? 2);
  const [submitting, setSubmitting] = useState(false);
  const [sectionId, setSectionId] = useState<number>(() => restaurant.sections[0]?.id ?? 0);

  const allTables = restaurant.sections.flatMap((s) => s.tables);
  const hasMultipleSections = restaurant.sections.length > 1;
  const sectionOptions = restaurant.sections.map((s) => ({ label: s.name, value: s.id }));
  const tablesInSection = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;

  const openTime = restaurant.openTime ?? "09:00";
  const closeTime = restaurant.closeTime ?? "22:00";
  const timezone = restaurant.timezone || "UTC";

  const [tableId, setTableId] = useState<number | undefined>();
  const [date, setDate] = useState<string>(() => suggestDate(closeTime, timezone));
  const [time, setTime] = useState<string>(
    () => initialTime ?? suggestTime(openTime, closeTime, timezone)
  );

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
    let eligible = pool.filter((t) => t.seats >= seatCount);
    if (availableIds && availableIds.length > 0) {
      eligible = eligible.filter((t) => availableIds.includes(t.id));
    }
    eligible.sort((a, b) => a.seats - b.seats);
    return eligible[0]?.id ?? pool[0]?.id;
  }

  const { holdStatus, secondsLeft, holdId, setHoldStatus, releaseCurrentHold } = useTableHold({
    restaurantId: restaurant.id,
    sections: restaurant.sections,
    tableId,
    date,
    time,
    email: customerEmail,
  });

  // Fetch availability when date/seats change
  useEffect(() => {
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

  // When availability or time changes, ensure we have a valid table selected
  useEffect(() => {
    const candidates = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
    if (availableTableIds.length > 0) {
      if (!tableId || !availableTableIds.includes(tableId)) {
        setTableId(bestTableFor(seats, availableTableIds, candidates));
      }
    } else {
      setTableId(bestTableFor(seats, undefined, candidates));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTableIds, seats]);

  // When section changes, release hold and pick best table in new section
  useEffect(() => {
    releaseCurrentHold();
    const candidates = restaurant.sections.find((s) => s.id === sectionId)?.tables ?? allTables;
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
    .filter((t) => t.seats >= seats)
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

  const isValid =
    !!tableId &&
    !!date &&
    !!time &&
    customerName.trim().length > 0 &&
    customerEmail.includes("@") &&
    holdStatus === "held" &&
    !isClosedDay;

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
        tableId,
        sectionId,
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
      <View style={styles.availabilityHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ThemedText style={styles.label}>Popular Times</ThemedText>
          {loadingAvailability && <ActivityIndicator size="small" color={PRIMARY} />}
        </View>
        <PopularTimesPicker slots={availabilitySlots} selectedTime={time} onSelectTime={setTime} />
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
            minTime={openTime}
            maxTime={closeTime}
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

      {restaurant.timezone && (
        <ThemedText style={[styles.timezoneHint, { color: colors.muted }]}>
          All times are in {timezone.replace(/_/g, " ")} (currently {restaurantCurrentTime} there)
        </ThemedText>
      )}

      {/* Row 3: Table + Full Name */}
      <View style={isWeb ? styles.fieldRow : undefined}>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
          <ThemedText style={styles.label}>Table</ThemedText>
          {eligibleTables.length === 0 ? (
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
              hasSelection={!!tableId && !!date && !!time}
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

      <Button onPress={handleSubmit} disabled={!isValid || submitting} style={styles.submitBtn}>
        {submitting ? (
          <View style={styles.submitContent}>
            <ActivityIndicator size="small" color="#fff" />
            <ThemedText style={styles.submitText}>Confirming…</ThemedText>
          </View>
        ) : (
          "Confirm Booking"
        )}
      </Button>

      {!submitting && holdStatus !== "held" && tableId && date && time && (
        <ThemedText style={styles.hint}>A table hold is required before confirming.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 4,
  },
  availabilityHeader: {
    marginBottom: 8,
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
    marginBottom: 4,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 4,
  },
  noTables: {
    color: "#e53e3e",
    fontSize: 13,
    marginBottom: 12,
  },
  timezoneHint: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: -4,
    marginBottom: 4,
  },
  submitBtn: {
    marginTop: 8,
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
    marginTop: 4,
  },
  gdpr: {
    fontSize: 12,
    opacity: 0.5,
    lineHeight: 18,
    marginTop: 8,
  },
});
