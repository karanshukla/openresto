import { useTranslation } from "react-i18next";
import Select from "@/components/common/Select";
import { lastBookingOptions } from "@/utils/openingHours";

/** The `Select` value standing in for "no last booking time": the API models that as null. */
export const UNTIL_CLOSE = "";

/**
 * The latest start a guest may book online for one service, picked from the quarter-hours
 * that service actually runs — so the control cannot offer a cutoff outside the window the
 * server would refuse. The first row is "Until close", which is the null the API stores.
 *
 * @see [LastBookingPicker.test.tsx](../../../tests/components/admin/settings/LastBookingPicker.test.tsx)
 * — pins that the options follow the window and that "Until close" comes back as null.
 */
export function LastBookingPicker({
  open,
  close,
  value,
  onChange,
  accessibilityLabel,
}: {
  open: string;
  close: string;
  value: string | null;
  onChange: (next: string | null) => void;
  accessibilityLabel: string;
}) {
  const { t } = useTranslation();
  const options = [
    { value: UNTIL_CLOSE, label: t("admin.settings.openingHours.lastBookingUntilClose") },
    ...lastBookingOptions(open, close).map((time) => ({ value: time, label: time })),
  ];
  return (
    <Select
      options={options}
      selectedValue={value ?? UNTIL_CLOSE}
      onSelect={(next) => onChange(next === UNTIL_CLOSE ? null : String(next))}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
