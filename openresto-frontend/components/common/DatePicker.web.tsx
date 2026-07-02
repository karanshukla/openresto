import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ThemedText } from "@/components/themed-text";
import { getThemeColors, COLORS, TYPOGRAPHY } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";

/** Convert a YYYY-MM-DD string to ISO day-of-week (1=Mon, 7=Sun) */
function getIsoDay(dateStr: string): number {
  const jsDay = new Date(dateStr + "T12:00:00").getDay(); // 0=Sun, 6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

export default function DatePicker({
  selectedDate,
  onSelect,
  openDays,
  allowPast,
}: {
  selectedDate?: string;
  onSelect: (date: string) => void;
  /** ISO day numbers that are open (1=Mon..7=Sun). If omitted, all days allowed. */
  openDays?: number[];
  /**
   * Opt-in: also allow past dates (back to today-365). Default false keeps the
   * customer flow restricted to today and later (hard `min={today}`).
   * Used by the admin New Booking modal.
   */
  allowPast?: boolean;
}) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const borderColor = colors.border;
  const bg = colors.input;
  const textColor = colors.text;
  const placeholderColor = colors.muted;

  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 29);
    return d.toISOString().split("T")[0];
  })();
  // Customers are hard-locked to today and later. Admins may back-date within a
  // bounded one-year window so the picker stays reasonable (opt-in via allowPast).
  const minDate = (() => {
    const d = new Date();
    if (allowPast) d.setDate(d.getDate() - 365);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const isClosedDay = !!(selectedDate && openDays && !openDays.includes(getIsoDay(selectedDate)));

  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper} testID="date-picker-web">
      <input
        type="date"
        value={selectedDate || ""}
        min={minDate}
        max={maxDate}
        onChange={(e) => onSelect(e.target.value)}
        style={
          {
            width: "100%",
            height: "44px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: isFocused ? primaryColor : isClosedDay ? COLORS.error : borderColor,
            borderRadius: "8px",
            paddingLeft: "12px",
            paddingRight: "12px",
            fontSize: "15px",
            fontFamily: "inherit",
            backgroundColor: bg,
            color: selectedDate ? textColor : placeholderColor,
            outline: "none",
            boxSizing: "border-box",
            cursor: "pointer",
            transition: "border-color 0.2s",
          } as React.CSSProperties
        }
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {isClosedDay && (
        <ThemedText style={styles.closedWarning}>
          Note: This restaurant is normally closed on this day. Please double-check another date.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
  closedWarning: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    marginTop: 4,
  },
});
