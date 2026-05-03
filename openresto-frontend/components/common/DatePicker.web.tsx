import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ThemedText } from "@/components/themed-text";
import { getThemeColors, COLORS } from "@/theme/theme";
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
}: {
  selectedDate?: string;
  onSelect: (date: string) => void;
  /** ISO day numbers that are open (1=Mon..7=Sun). If omitted, all days allowed. */
  openDays?: number[];
}) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const borderColor = colors.border;
  const bg = colors.input;
  const textColor = colors.text;
  const placeholderColor = colors.muted;

  const today = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 29);
    return d.toISOString().split("T")[0];
  })();

  const isClosedDay = !!(selectedDate && openDays && !openDays.includes(getIsoDay(selectedDate)));

  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <input
        type="date"
        value={selectedDate || ""}
        min={today}
        max={maxDate}
        onChange={(e) => onSelect(e.target.value)}
        style={
          {
            width: "100%",
            height: "44px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: isFocused ? primaryColor : isClosedDay ? "#dc2626" : borderColor,
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
    fontSize: 12,
    color: "#dc2626",
    marginTop: 4,
  },
});
