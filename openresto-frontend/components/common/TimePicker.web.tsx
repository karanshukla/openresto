import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TimePicker({
  selectedTime,
  onSelect,
}: {
  selectedTime?: string;
  onSelect: (time: string) => void;
}) {
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.18)";
  const bg = isDark ? "#1c1c1e" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#000000";
  const placeholderColor = "#9ca3af";

  return (
    <View style={styles.wrapper}>
      <input
        type="time"
        value={selectedTime ?? ""}
        min="09:00"
        max="22:00"
        step={1800}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
        style={{
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
        } as React.CSSProperties}
        onFocus={(e) => {
          e.target.style.borderColor = "#0a7ea4";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = borderColor;
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
