import { ActivityIndicator, View } from "react-native";
import Input from "../common/Input";
import Select, { type SelectOption } from "../common/Select";
import DatePicker from "../common/DatePicker";
import TimePicker from "../common/TimePicker";
import { ThemedText } from "../themed-text";
import { styles } from "./BookingForm.styles";

/**
 * The individual form controls of BookingForm, so the two layouts (inline page and drawer)
 * read as an arrangement of named fields rather than a wall of JSX. Each is presentational:
 * value in, change out.
 */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
    </View>
  );
}

export function GuestsField({
  label,
  seats,
  options,
  onChange,
}: {
  label: string;
  seats: number;
  options: SelectOption[];
  onChange: (seats: number) => void;
}) {
  return (
    <Field label={label}>
      <Select
        icon="people-outline"
        accessibilityLabel="Number of guests"
        selectedValue={seats}
        onSelect={(v) => onChange(v as number)}
        options={options}
      />
    </Field>
  );
}

export function DateField({
  date,
  bookableDays,
  onChange,
}: {
  date: string;
  /** ISO days this location takes online bookings on — closed and walk-in-only days are absent. */
  bookableDays?: number[];
  onChange: (date: string) => void;
}) {
  return (
    <Field label="Date">
      {/* Customer flow: future-dates-only is intentional. Do NOT pass allowPast
          here — only the admin New Booking modal opts in to back-dating (#160). */}
      <DatePicker selectedDate={date} onSelect={onChange} openDays={bookableDays} />
    </Field>
  );
}

export function TimeField({
  label,
  time,
  minTime,
  maxTime,
  onChange,
}: {
  label: string;
  time: string;
  minTime: string;
  maxTime: string;
  onChange: (time: string) => void;
}) {
  return (
    <Field label={label}>
      <TimePicker selectedTime={time} onSelect={onChange} minTime={minTime} maxTime={maxTime} />
    </Field>
  );
}

export function SectionField({
  sectionId,
  options,
  onChange,
}: {
  sectionId: number;
  options: SelectOption[];
  onChange: (sectionId: number) => void;
}) {
  return (
    <Field label="Section">
      <Select
        accessibilityLabel="Section"
        selectedValue={sectionId}
        onSelect={(val) => onChange(val as number)}
        options={options}
        placeholder="Select a section"
      />
    </Field>
  );
}

export function TableField({
  isAutoAssign,
  /** Set once a hold resolves to a concrete table, which sharpens the auto-assign copy. */
  resolvedTableId,
  options,
  selectedValue,
  seats,
  mutedColor,
  onChange,
}: {
  isAutoAssign: boolean;
  resolvedTableId?: number | null;
  options: SelectOption[];
  selectedValue: number | undefined;
  seats: number;
  mutedColor: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label="Table">
      {isAutoAssign ? (
        <ThemedText style={[styles.autoAssignHint, { color: mutedColor }]}>
          We'll seat you at the best available table
          {resolvedTableId ? "" : " across all sections"}.
        </ThemedText>
      ) : options.length === 0 ? (
        <ThemedText style={[styles.noTables, { color: mutedColor }]}>
          No tables available for {seats} guests.
        </ThemedText>
      ) : (
        <Select
          accessibilityLabel="Table"
          selectedValue={selectedValue}
          onSelect={(val) => onChange(val as number)}
          options={options}
          placeholder="Select a table"
        />
      )}
    </Field>
  );
}

export function NameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Full Name">
      <Input
        placeholder="Your full name"
        accessibilityLabel="Full name"
        value={value}
        onChangeText={onChange}
        autoCapitalize="words"
        returnKeyType="next"
        blurOnSubmit={false}
      />
    </Field>
  );
}

export function EmailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Email">
      <Input
        placeholder="your@email.com"
        accessibilityLabel="Email address"
        value={value}
        onChangeText={onChange}
        keyboardType="email-address"
        autoCapitalize="none"
        returnKeyType="next"
        blurOnSubmit={false}
      />
    </Field>
  );
}

export function RequestsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Input
        placeholder="e.g. nut allergy, high chair needed… (optional)"
        accessibilityLabel="Special requests or allergies"
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={3}
        style={styles.textarea}
      />
    </Field>
  );
}

/** Drawer-only group heading, with a spinner while the times underneath are refreshing. */
export function SectionHeading({
  label,
  busy = false,
  mutedColor,
  primaryColor,
}: {
  label: string;
  busy?: boolean;
  mutedColor: string;
  primaryColor: string;
}) {
  return (
    <View style={styles.sectionHeadingRow}>
      <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>{label}</ThemedText>
      {busy && (
        <ActivityIndicator
          size="small"
          color={primaryColor}
          accessibilityLabel="Loading available times"
        />
      )}
    </View>
  );
}
