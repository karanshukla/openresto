import { RestaurantDto } from "@/api/restaurants";
import { useEffect, useRef, useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import DatePicker from "../common/DatePicker";
import TimePicker from "../common/TimePicker";
import { ThemedText } from "../themed-text";
import { ThemedView } from "../themed-view";
import { ActivityIndicator, StyleSheet } from "react-native";
import { createHold, releaseHold, HoldResponse } from "@/api/holds";

export interface BookingFormData {
  customerEmail: string;
  seats: number;
  tableId: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  holdId: string | null;
}

type HoldStatus = "idle" | "pending" | "held" | "unavailable" | "expired";

const HOLD_DEBOUNCE_MS = 2000;

export default function BookingForm({
  restaurant,
  onSubmit,
}: {
  restaurant: RestaurantDto;
  onSubmit: (data: BookingFormData) => void;
}) {
  const [customerEmail, setCustomerEmail] = useState("");
  const [seats, setSeats] = useState(1);
  const allTables = restaurant.sections.flatMap((s) => s.tables);
  const [tableId, setTableId] = useState<number | undefined>(allTables[0]?.id);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [time, setTime] = useState<string | undefined>(undefined);

  // Hold state
  const [hold, setHold] = useState<HoldResponse | null>(null);
  const [holdStatus, setHoldStatus] = useState<HoldStatus>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Refs to keep latest values accessible inside callbacks without stale closures
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
      const secs = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
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
      releaseHold(currentHoldId.current); // fire-and-forget
      currentHoldId.current = null;
    }
    setHold(null);
    setHoldStatus("idle");
    clearCountdown();
  }

  // ---------- debounced hold trigger ----------

  useEffect(() => {
    // Can only attempt a hold when all three selection fields are filled
    if (!tableId || !date || !time) {
      setHoldStatus("idle");
      return;
    }

    // If the user already has a valid hold for this exact table+date+time, keep it
    if (hold && holdStatus === "held") {
      const holdDate = `${date}T${time}:00`;
      // Nothing to do — hold is still good
      return;
    }

    // Debounce: release any pending timer before starting a new one
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    setHoldStatus("pending");

    debounceTimer.current = setTimeout(async () => {
      // Release any previously held hold before requesting a new one
      await releaseCurrentHold();

      const sectionId =
        restaurant.sections.find((s) =>
          s.tables.some((t) => t.id === tableId)
        )?.id ?? 0;

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
  // Re-run whenever the user changes table, date, or time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, date, time]);

  // Release hold when the component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      clearCountdown();
      if (currentHoldId.current) releaseHold(currentHoldId.current);
    };
  }, []);

  // ---------- submit ----------

  const isValid =
    !!tableId &&
    !!date &&
    !!time &&
    customerEmail.includes("@") &&
    holdStatus === "held";

  const handleSubmit = () => {
    if (isValid) {
      onSubmit({
        customerEmail,
        seats,
        tableId,
        date,
        time,
        holdId: currentHoldId.current,
      });
    }
  };

  // ---------- options ----------

  const seatOptions = [...Array(10).keys()].map((i) => ({
    label: `${i + 1} seat${i > 0 ? "s" : ""}`,
    value: i + 1,
  }));
  const tableOptions = allTables.map((table) => ({
    label: `${table.name ?? `Table ${table.id}`} (capacity: ${table.seats})`,
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
            <ThemedText style={styles.holdPending}>
              Checking availability…
            </ThemedText>
          </ThemedView>
        );
      case "held":
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        return (
          <ThemedView style={styles.holdRow}>
            <ThemedText style={styles.holdHeld}>
              ✓ Table held — expires in {mins}:{secs.toString().padStart(2, "0")}
            </ThemedText>
          </ThemedView>
        );
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
          <ThemedView style={styles.holdRow}>
            <ThemedText style={styles.holdUnavailable}>
              Hold expired. Please re-select the table to try again.
            </ThemedText>
          </ThemedView>
        );
      default:
        return null;
    }
  }

  // ---------- render ----------

  return (
    <>
      <ThemedText>Email</ThemedText>
      <Input
        placeholder="your@email.com"
        value={customerEmail}
        onChangeText={setCustomerEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <ThemedText>Date</ThemedText>
      <DatePicker selectedDate={date} onSelect={setDate} />

      <ThemedText>Time</ThemedText>
      <TimePicker selectedTime={time} onSelect={setTime} />

      <ThemedText>Number of Seats</ThemedText>
      <Select
        selectedValue={seats}
        onSelect={setSeats}
        options={seatOptions}
      />

      <ThemedText>Table</ThemedText>
      <Select
        selectedValue={tableId}
        onSelect={(val) => {
          // Changing table triggers a new hold attempt; reset expired state
          if (holdStatus === "held" || holdStatus === "expired") {
            setHoldStatus("idle");
          }
          setTableId(val);
        }}
        options={tableOptions}
        placeholder="Select a table"
      />

      {renderHoldStatus()}

      <Button
        onPress={handleSubmit}
        disabled={!isValid}
      >
        Confirm Booking
      </Button>

      {holdStatus !== "held" && tableId && date && time && (
        <ThemedText style={styles.hint}>
          A table hold is required before confirming.
        </ThemedText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
  hint: {
    opacity: 0.5,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});
