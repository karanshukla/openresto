import Select from "@/components/common/Select";
import { generateTimeOptions } from "@/utils/timeOptions";

export { generateTimeOptions };

/**
 * Time-of-day picker: a `Select` over the 15-minute slots between two bounds.
 *
 * It used to be two hand-rolled files — a centred `Modal` on native and a second, differently
 * styled one on web — each with its own trigger, its own option rows and the same wrong
 * `menu`/`menuitem` roles `Select` carried (issue #348). There was never anything time-specific
 * below the option list, so there is nothing left here but the options.
 *
 * @see [TimePicker.test.tsx](../../tests/components/TimePicker.test.tsx) — pins that the
 * bounds reach the option list and that a pick comes back as an "HH:mm" string.
 */
export default function TimePicker({
  selectedTime,
  onSelect,
  minTime = "09:00",
  maxTime = "22:00",
}: {
  selectedTime?: string;
  onSelect: (time: string) => void;
  minTime?: string;
  maxTime?: string;
}) {
  return (
    <Select
      options={generateTimeOptions(minTime, maxTime)}
      selectedValue={selectedTime}
      onSelect={(value) => onSelect(String(value))}
      placeholder="Select a time"
      accessibilityLabel="Time"
    />
  );
}
