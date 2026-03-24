import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ThemedText } from "@/components/themed-text";

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
  const borderColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.18)";
  const bg = isDark ? "#1c1c1e" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#000000";
  const placeholderColor = "#9ca3af";

  const today = new Date().toISOString().split("T")[0];
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 29);
    return d.toISOString().split("T")[0];
  })();

  const isClosedDay =
    selectedDate && openDays ? !openDays.includes(getIsoDay(selectedDate)) : false;

  const DAY_NAMES: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
  };

  return (
    <View style={styles.wrapper}>
      <input
        type="date"
        value={selectedDate ?? ""}
        min={today}
        max={maxDate}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        style={
          {
            width: "100%",
            height: 44,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: isClosedDay ? "#dc2626" : borderColor,
            borderRadius: 8,
            paddingLeft: 12,
            paddingRight: 12,
            fontSize: 15,
            backgroundColor: bg,
            color: selectedDate ? textColor : placeholderColor,
            outline: "none",
            boxSizing: "border-box",
            cursor: "pointer",
          } as React.CSSProperties
        }
        onFocus={(e) => {
          e.target.style.borderColor = isClosedDay ? "#dc2626" : "#0a7ea4";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = isClosedDay ? "#dc2626" : borderColor;
        }}
      />
      {isClosedDay && selectedDate && (
        <ThemedText style={styles.closedWarning}>
          Closed on {DAY_NAMES[getIsoDay(selectedDate)] ?? "this day"}. Please pick another date.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  closedWarning: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 4,
  },
});
