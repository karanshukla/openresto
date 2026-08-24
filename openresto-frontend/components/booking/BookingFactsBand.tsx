import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BookingDto } from "@/api/bookings";
import { fmtDate, fmtTime, fmtYear } from "@/utils/formatters";
import { styles } from "./BookingFactsBand.styles";

interface BookingFactsBandProps {
  booking: BookingDto;
  /** Phone-width sheet: date and time share a cell so two cells fit instead of three. */
  compact?: boolean;
  mutedColor: string;
  borderColor: string;
  /** Cancelled: the sitting is no longer happening, so its facts read as struck. */
  negated?: boolean;
}

type Fact = { key: string; value: string; sub?: string };

const formatTime = (value: string): string | undefined => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return fmtTime(d);
};

export function buildFacts(booking: BookingDto, compact: boolean): Fact[] {
  const date = new Date(booking.date);
  const day = fmtDate(date);
  const time = formatTime(booking.date) ?? "";
  const until = booking.endTime ? formatTime(booking.endTime) : undefined;
  const party = {
    key: "Guests",
    value: String(booking.seats),
    sub: booking.tableSeats ? `Table for ${booking.tableSeats}` : undefined,
  };

  if (compact) {
    return [{ key: "Date & time", value: day, sub: time }, party];
  }

  return [
    { key: "Date", value: day, sub: fmtYear(date) },
    { key: "Time", value: time, sub: until ? `until ${until}` : undefined },
    party,
  ];
}

/**
 * Date, time and party size as a band of equal cells across the top of the card. These are
 * the three things a booking is looked up to check, so they carry their own weight instead
 * of sitting as three of eleven identically-styled rows.
 */
export default function BookingFactsBand({
  booking,
  compact = false,
  mutedColor,
  borderColor,
  negated = false,
}: BookingFactsBandProps) {
  const facts = buildFacts(booking, compact);

  return (
    <View style={styles.band}>
      {facts.map((fact, i) => (
        <View
          key={fact.key}
          style={[styles.cell, i > 0 && [styles.cellDivided, { borderLeftColor: borderColor }]]}
        >
          <ThemedText style={[styles.key, { color: mutedColor }]}>{fact.key}</ThemedText>
          <ThemedText
            style={[styles.value, negated && [styles.valueNegated, { color: mutedColor }]]}
          >
            {fact.value}
          </ThemedText>
          {fact.sub ? (
            <ThemedText style={[styles.sub, { color: mutedColor }]}>{fact.sub}</ThemedText>
          ) : null}
        </View>
      ))}
    </View>
  );
}
