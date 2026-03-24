import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

function roundTo15(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const rounded = Math.round((h * 60 + m) / 15) * 15;
  const rh = Math.floor(rounded / 60) % 24;
  const rm = rounded % 60;
  return `${rh.toString().padStart(2, "0")}:${rm.toString().padStart(2, "0")}`;
}

function clampTime(time: string, min: string, max: string): string {
  if (time < min) return min;
  if (time > max) return max;
  return time;
}

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
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.18)";
  const bg = isDark ? "#1c1c1e" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#000000";
  const placeholderColor = "#9ca3af";

  const handleChange = (value: string) => {
    if (!value) return;
    const rounded = clampTime(roundTo15(value), minTime, maxTime);
    onSelect(rounded);
  };

  return (
    <View style={styles.wrapper}>
      <input
        type="time"
        value={selectedTime ?? ""}
        min={minTime}
        max={maxTime}
        step={900}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => {
          if (e.target.value) handleChange(e.target.value);
          e.target.style.borderColor = borderColor;
        }}
        style={
          {
            width: "100%",
            height: 44,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor,
            borderRadius: 8,
            paddingLeft: 12,
            paddingRight: 12,
            fontSize: 15,
            backgroundColor: bg,
            color: selectedTime ? textColor : placeholderColor,
            outline: "none",
            boxSizing: "border-box",
            cursor: "pointer",
          } as React.CSSProperties
        }
        onFocus={(e) => {
          e.target.style.borderColor = "#0a7ea4";
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
});
