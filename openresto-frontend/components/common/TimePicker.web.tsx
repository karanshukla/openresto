import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";

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
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const borderColor = colors.border;
  const bg = colors.input;
  const textColor = colors.text;
  const placeholderColor = colors.muted;

  const handleChange = (value: string) => {
    if (!value) return;
    const rounded = clampTime(roundTo15(value), minTime, maxTime);
    onSelect(rounded);
  };

  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.wrapper} testID="time-picker-web">
      <input
        type="time"
        data-testid="time-input"
        value={selectedTime || ""}
        step={900}
        onChange={(e) => handleChange(e.target.value)}
        style={
          {
            width: "100%",
            height: "44px",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: isFocused ? primaryColor : borderColor,
            borderRadius: "8px",
            paddingLeft: "12px",
            paddingRight: "12px",
            fontSize: "15px",
            fontFamily: "inherit",
            backgroundColor: bg,
            color: selectedTime ? textColor : placeholderColor,
            outline: "none",
            boxSizing: "border-box",
            cursor: "pointer",
            transition: "border-color 0.2s",
          } as React.CSSProperties
        }
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
});
