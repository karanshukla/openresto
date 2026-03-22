import { RestaurantDto } from "@/api/restaurants";
import { useEffect, useRef, useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import DatePicker from "../common/DatePicker";
import TimePicker from "../common/TimePicker";
import { ThemedText } from "../themed-text";
import { ThemedView } from "../themed-view";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { createHold, releaseHold, HoldResponse } from "@/api/holds";

const isWeb = Platform.OS === "web";

export interface BookingFormData {
  customerEmail: string;
  seats: number;
  tableId: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  holdId: string | null;
  specialRequests: string;
}

type HoldStatus = "idle" | "pending" | "held" | "unavailable" | "expired";

const HOLD_DEBOUNCE_MS = 2000;

// ── Auto-suggestion helpers ────────────────────────────────────────────────

function suggestDate(closeHour: number): string {
  const now = new Date();
  // If there's still at least one 15-min slot left today, suggest today
  const latestStart = new Date(now);
  latestStart.setHours(closeHour - 1, 45, 0, 0);
  if (now < latestStart) {
    return now.toISOString().split("T")[0];
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function suggestTime(openTime: string, closeTime: string): string {
  const now = new Date();
  // Round up to next 15-minute boundary
  let h = now.getHours();
  const min = now.getMinutes();
  const m = min < 15 ? 15 : min < 30 ? 30 : min < 45 ? 45 : 0;
  if (m === 0) h += 1;

  const [openH] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const closeTotal = closeH * 60 + closeM;
  const currentTotal = h * 60 + m;

  // If outside hours, default to 1 hour after open
  if (currentTotal < openH * 60 || currentTotal > closeTotal) {
    return `${(openH + 1).toString().padStart(2, "0")}:00`;
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export default function BookingForm({
  restaurant,
  onSubmit,
  onRefresh,
}: {
  restaurant: RestaurantDto;
  onSubmit: (data: BookingFormData) => void;
  onRefresh?: () => void;
}) {
  const [customerEmail, setCustomerEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [seats, setSeats] = useState(2);
  const allTables = restaurant.sections.flatMap((s) => s.tables);

  // Pick the smallest table that fits the initial seat count
  function bestTableFor(seatCount: number) {
    const eligible = allTables.filter((t) => t.seats >= seatCount);
    eligible.sort((a, b) => a.seats - b.seats);
    return eligible[0]?.id ?? allTables[0]?.id;
  }

  const openTime = restaurant.openTime ?? "09:00";
  const closeTime = restaurant.closeTime ?? "22:00";
  const [closeH] = closeTime.split(":").map(Number);

  const [tableId, setTableId] = useState<number | undefined>(() => bestTableFor(2));
  const [date, setDate] = useState<string>(() => suggestDate(closeH));
  const [time, setTime] = useState<string>(() => suggestTime(openTime, closeTime));

  // When seats change, auto-update table to smallest fitting one
  useEffect(() => {
    setTableId(bestTableFor(seats));
    // Reset hold so a new one is requested for the new table
    releaseCurrentHold();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

  // Hold state
  const [hold, setHold] = useState<HoldResponse | null>(null);
  const [holdStatus, setHoldStatus] = useState<HoldStatus>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentHoldId = useRef<string | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------- helpers ----------

  function clearCountdown() {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }

  function startCountdown(expiresAt: string) {
    clearCountdown();
    const update = () => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(secs);
      if (secs === 0) {
        clearCountdown();
        setHoldStatus("expired");
        setHold(null);
        currentHoldId.current = null;
      }
    };
    update();
    countdownTimer.current = setInterval(update, 1000);
  }

  async function releaseCurrentHold() {
    if (currentHoldId.current) {
      releaseHold(currentHoldId.current);
      currentHoldId.current = null;
    }
    setHold(null);
    setHoldStatus("idle");
    clearCountdown();
  }

  // ---------- debounced hold trigger ----------

  useEffect(() => {
    if (!tableId || !date || !time) {
      setHoldStatus("idle");
      return;
    }

    if (hold && holdStatus === "held") return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setHoldStatus("pending");

    debounceTimer.current = setTimeout(async () => {
      await releaseCurrentHold();

      const sectionId =
        restaurant.sections.find((s) => s.tables.some((t) => t.id === tableId))?.id ?? 0;

      const isoDate = new Date(`${date}T${time}:00`).toISOString();

      const result = await createHold({
        restaurantId: restaurant.id,
        tableId,
        sectionId,
        date: isoDate,
      });

      if (result) {
        currentHoldId.current = result.holdId;
        setHold(result);
        setHoldStatus("held");
        startCountdown(result.expiresAt);
      } else {
        setHoldStatus("unavailable");
      }
    }, HOLD_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, date, time]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      clearCountdown();
      if (currentHoldId.current) releaseHold(currentHoldId.current);
    };
  }, []);

  // ---------- submit ----------

  const isValid =
    !!tableId && !!date && !!time && customerEmail.includes("@") && holdStatus === "held";

  const handleSubmit = () => {
    if (isValid) {
      onSubmit({
        customerEmail,
        seats,
        tableId,
        date,
        time,
        holdId: currentHoldId.current,
        specialRequests,
      });
    }
  };

  // ---------- options ----------

  const seatOptions = [...Array(10).keys()].map((i) => ({
    label: `${i + 1} seat${i > 0 ? "s" : ""}`,
    value: i + 1,
  }));

  // Only show tables that can fit the selected seat count, sorted smallest-first
  const eligibleTables = allTables
    .filter((t) => t.seats >= seats)
    .sort((a, b) => a.seats - b.seats);

  const tableOptions = eligibleTables.map((table) => ({
    label: `${table.name ?? `Table ${table.id}`} (${table.seats} seats)`,
    value: table.id,
  }));

  // ---------- hold status label ----------

  function renderHoldStatus() {
    if (!tableId || !date || !time) return null;

    switch (holdStatus) {
      case "pending":
        return (
          <ThemedView style={styles.holdRow}>
            <ActivityIndicator size="small" />
            <ThemedText style={styles.holdPending}>Checking availability…</ThemedText>
          </ThemedView>
        );
      case "held": {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        return (
          <ThemedView style={styles.holdRow}>
            <ThemedText style={styles.holdHeld}>
              ✓ Table held — expires in {mins}:{secs.toString().padStart(2, "0")}
            </ThemedText>
          </ThemedView>
        );
      }
      case "unavailable":
        return (
          <ThemedView style={styles.holdRow}>
            <ThemedText style={styles.holdUnavailable}>
              ✗ Table not available for this date. Please choose another.
            </ThemedText>
          </ThemedView>
        );
      case "expired":
        return (
          <ThemedView style={styles.expiredBox}>
            <ThemedText style={styles.holdUnavailable}>
              Your table hold expired. Availability may have changed.
            </ThemedText>
            {onRefresh && (
              <Pressable onPress={onRefresh} style={styles.refreshBtn}>
                <ThemedText style={styles.refreshBtnText}>Refresh page</ThemedText>
              </Pressable>
            )}
          </ThemedView>
        );
      default:
        return null;
    }
  }

  // ---------- render ----------

  return (
    <View style={styles.form}>
      {/* Row 1: Guests + Date */}
      <View style={isWeb ? styles.fieldRow : undefined}>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
          <ThemedText style={styles.label}>Number of Guests</ThemedText>
          <Select selectedValue={seats} onSelect={setSeats} options={seatOptions} />
        </View>
        <View style={[styles.field, isWeb && styles.fieldHalf]}>
          <ThemedText style={styles.label}>Date</ThemedText>
          <DatePicker selectedDate={date} onSelect={setDate} />
        </View>
      </View>

      {/* Row 2: Time + Table */}
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
          <ThemedText style={styles.label}>Table</ThemedText>
          {eligibleTables.length === 0 ? (
            <ThemedText style={styles.noTables}>No tables available for {seats} guests.</ThemedText>
          ) : (
            <Select
              selectedValue={tableId}
              onSelect={(val) => {
                if (holdStatus === "held" || holdStatus === "expired") {
                  setHoldStatus("idle");
                }
                setTableId(val);
              }}
              options={tableOptions}
              placeholder="Select a table"
            />
          )}
        </View>
      </View>

      {/* Row 3: Email + Special Requests */}
      <View style={isWeb ? styles.fieldRow : undefined}>
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

      {/* Hold status — below all fields */}
      {renderHoldStatus()}

      <Button onPress={handleSubmit} disabled={!isValid} style={styles.submitBtn}>
        Confirm Booking
      </Button>

      {holdStatus !== "held" && tableId && date && time && (
        <ThemedText style={styles.hint}>A table hold is required before confirming.</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 4,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 16,
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
  holdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  holdPending: {
    opacity: 0.6,
    fontSize: 13,
  },
  holdHeld: {
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "600",
  },
  holdUnavailable: {
    color: "#e53e3e",
    fontSize: 13,
  },
  expiredBox: {
    gap: 8,
    marginBottom: 12,
    backgroundColor: "transparent",
  },
  refreshBtn: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: "rgba(229,62,62,0.12)",
    cursor: "pointer" as any,
  },
  refreshBtnText: {
    color: "#e53e3e",
    fontSize: 13,
    fontWeight: "600",
  },
  noTables: {
    color: "#e53e3e",
    fontSize: 13,
    marginBottom: 12,
  },
  submitBtn: {
    marginTop: 8,
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
});
