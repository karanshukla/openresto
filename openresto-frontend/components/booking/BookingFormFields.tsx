import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <Select
        icon="people-outline"
        accessibilityLabel={t("booking.form.guestsSelectLabel")}
        selectedValue={seats}
        onSelect={(v) => onChange(v as number)}
        options={options}
      />
    </Field>
  );
}

export function DateField({
  date,
  openDays,
  walkInDays,
  onChange,
}: {
  date: string;
  /** ISO days the location is open. A closed day is not a candidate, so it is not listed. */
  openDays?: number[];
  /** Open days that take no online bookings. Listed but unpickable, so the reason is visible. */
  walkInDays?: number[];
  onChange: (date: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field label={t("booking.form.dateLabel")}>
      {/* Customer flow: future-dates-only is intentional. Do NOT pass allowPast
          here — only the admin New Booking modal opts in to back-dating (#160). */}
      <DatePicker
        selectedDate={date}
        onSelect={onChange}
        openDays={openDays}
        unavailableDays={walkInDays}
        unavailableReason={t("booking.form.walkInsOnlyReason")}
      />
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
  const { t } = useTranslation();
  return (
    <Field label={t("booking.form.sectionLabel")}>
      <Select
        accessibilityLabel={t("booking.form.sectionLabel")}
        selectedValue={sectionId}
        onSelect={(val) => onChange(val as number)}
        options={options}
        placeholder={t("booking.form.selectSectionPlaceholder")}
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
  const { t } = useTranslation();
  return (
    <Field label={t("booking.form.tableLabel")}>
      {isAutoAssign ? (
        <ThemedText style={[styles.autoAssignHint, { color: mutedColor }]}>
          {resolvedTableId
            ? t("booking.form.autoAssignHint")
            : t("booking.form.autoAssignHintAllSections")}
        </ThemedText>
      ) : options.length === 0 ? (
        <ThemedText style={[styles.noTables, { color: mutedColor }]}>
          {t("booking.form.noTablesAvailable", { count: seats })}
        </ThemedText>
      ) : (
        <Select
          accessibilityLabel={t("booking.form.tableLabel")}
          selectedValue={selectedValue}
          onSelect={(val) => onChange(val as number)}
          options={options}
          placeholder={t("booking.form.selectTablePlaceholder")}
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
  const { t } = useTranslation();
  return (
    <Field label={t("booking.form.fullNameLabel")}>
      <Input
        placeholder={t("booking.form.fullNamePlaceholder")}
        accessibilityLabel={t("booking.form.fullNameAccessibilityLabel")}
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
  const { t } = useTranslation();
  return (
    <Field label={t("booking.form.emailLabel")}>
      <Input
        placeholder={t("booking.form.emailPlaceholder")}
        accessibilityLabel={t("booking.form.emailAccessibilityLabel")}
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
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <Input
        placeholder={t("booking.form.requestsPlaceholder")}
        accessibilityLabel={t("booking.form.requestsAccessibilityLabel")}
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
  const { t } = useTranslation();
  return (
    <View style={styles.sectionHeadingRow}>
      <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>{label}</ThemedText>
      {busy && (
        <ActivityIndicator
          size="small"
          color={primaryColor}
          accessibilityLabel={t("booking.form.loadingTimesLabel")}
        />
      )}
    </View>
  );
}
