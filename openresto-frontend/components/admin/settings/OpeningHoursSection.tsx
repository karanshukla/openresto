import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import TimePicker from "@/components/common/TimePicker";
import { DAY_LABELS, DAY_SHORT, modeButton } from "./sectionHelpers";
import { styles } from "./settings.styles";

type WeekHours = Record<number, { open: string; close: string }>;

export interface OpeningHoursSectionProps {
  customHours: boolean;
  openTime: string;
  closeTime: string;
  weekHours: WeekHours;
  openDays: number[];
  /** Shown when any active day's close ≤ open (overnight). */
  anyOvernight: boolean;
  // Callbacks — the parent (RestaurantInfoForm) owns the state.
  onSetCustomHours: (v: boolean) => void;
  onSetOpenTime: (t: string) => void;
  onSetCloseTime: (t: string) => void;
  onSetDayHours: (day: number, patch: Partial<{ open: string; close: string }>) => void;
  onCopyHoursToAllDays: (day: number) => void;
  onToggleDay: (day: number) => void;
  // Theme values (presentational).
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  cardBg: string;
  textColor: string;
  surface2: string;
  isDark: boolean;
}

/**
 * The "Opening hours" section of RestaurantInfoForm — uniform (same every day) vs custom
 * per-day hours, plus the open-days toggle grid. Presentational: receives all state + setters
 * as props, owns no data fetching. Extracted during Bundle 9B-1 decomposition.
 */
export function OpeningHoursSection({
  customHours,
  openTime,
  closeTime,
  weekHours,
  openDays,
  anyOvernight,
  onSetCustomHours,
  onSetOpenTime,
  onSetCloseTime,
  onSetDayHours,
  onCopyHoursToAllDays,
  onToggleDay,
  borderColor,
  mutedColor,
  primaryColor,
  cardBg,
  textColor,
  surface2,
  isDark,
}: OpeningHoursSectionProps) {
  const modeTheme = { borderColor, mutedColor, textColor, isDark };

  return (
    <View
      style={{
        gap: 12,
        borderWidth: 1,
        borderColor,
        borderRadius: 12,
        padding: 14,
        backgroundColor: surface2,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <View style={{ gap: 2 }}>
          <ThemedText style={{ fontSize: 13, fontWeight: "600" }}>Opening hours</ThemedText>
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            {openDays.length} of 7 days open
          </ThemedText>
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: 2,
            padding: 3,
            borderRadius: 9,
            backgroundColor: isDark ? "#1b1d1f" : "#eef0f2",
          }}
        >
          {modeButton(
            "Same every day",
            !customHours,
            () => onSetCustomHours(false),
            "hours-mode-uniform",
            modeTheme
          )}
          {modeButton(
            "Custom per day",
            customHours,
            () => onSetCustomHours(true),
            "hours-mode-custom",
            modeTheme
          )}
        </View>
      </View>

      {!customHours ? (
        <>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Opens</ThemedText>
              <TimePicker
                selectedTime={openTime}
                onSelect={onSetOpenTime}
                minTime="00:00"
                maxTime="23:45"
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Closes</ThemedText>
              <TimePicker
                selectedTime={closeTime}
                onSelect={onSetCloseTime}
                minTime="00:00"
                maxTime="23:45"
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Open days</ThemedText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DAY_LABELS.map((label, i) => {
                const day = i + 1;
                const active = openDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => onToggleDay(day)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={{
                      minWidth: 96,
                      flexGrow: 1,
                      backgroundColor: active ? primaryColor : cardBg,
                      borderWidth: 1,
                      borderColor: active ? primaryColor : borderColor,
                      borderRadius: 9,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      alignItems: "center",
                    }}
                  >
                    <ThemedText
                      style={{
                        fontSize: 12,
                        fontWeight: "500",
                        color: active ? "#fff" : textColor,
                      }}
                    >
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={{ fontSize: 11, color: mutedColor }}>
              Tap a day to mark it open or closed.
            </ThemedText>
          </View>
        </>
      ) : (
        <View style={{ gap: 8 }}>
          {DAY_SHORT.map((label, i) => {
            const day = i + 1;
            const active = openDays.includes(day);
            const hours = weekHours[day];
            return (
              <View
                key={day}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  opacity: active ? 1 : 0.75,
                }}
              >
                <Pressable
                  onPress={() => onToggleDay(day)}
                  testID={`day-toggle-${day}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${DAY_LABELS[i]}: ${active ? "open" : "closed"}. Tap to toggle.`}
                  style={{
                    width: 58,
                    backgroundColor: active ? primaryColor : cardBg,
                    borderWidth: 1,
                    borderColor: active ? primaryColor : borderColor,
                    borderRadius: 8,
                    paddingVertical: 9,
                    alignItems: "center",
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: active ? "#fff" : mutedColor,
                    }}
                  >
                    {label}
                  </ThemedText>
                </Pressable>

                {active ? (
                  <>
                    <View style={{ flex: 1, minWidth: 96 }}>
                      <TimePicker
                        selectedTime={hours.open}
                        onSelect={(t) => onSetDayHours(day, { open: t })}
                        minTime="00:00"
                        maxTime="23:45"
                      />
                    </View>
                    <ThemedText style={{ fontSize: 12, color: mutedColor }}>–</ThemedText>
                    <View style={{ flex: 1, minWidth: 96 }}>
                      <TimePicker
                        selectedTime={hours.close}
                        onSelect={(t) => onSetDayHours(day, { close: t })}
                        minTime="00:00"
                        maxTime="23:45"
                      />
                    </View>
                    <Pressable
                      onPress={() => onCopyHoursToAllDays(day)}
                      testID={`copy-hours-${day}`}
                      accessibilityLabel={`Copy ${DAY_LABELS[i]}'s hours to every day`}
                      style={(state) => ({
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: (state as { hovered?: boolean }).hovered
                          ? primaryColor
                          : borderColor,
                        backgroundColor: cardBg,
                        alignItems: "center",
                        justifyContent: "center",
                      })}
                    >
                      <Ionicons name="copy-outline" size={14} color={mutedColor} />
                    </Pressable>
                  </>
                ) : (
                  <ThemedText
                    style={{ flex: 1, fontSize: 12.5, color: mutedColor, fontStyle: "italic" }}
                  >
                    Closed
                  </ThemedText>
                )}
              </View>
            );
          })}
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            Tap a day to mark it open or closed. Use{" "}
            <Ionicons name="copy-outline" size={11} color={mutedColor} /> to apply one day's hours
            to the whole week.
          </ThemedText>
        </View>
      )}

      {anyOvernight && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="moon-outline" size={12} color={mutedColor} />
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            A closing time at or before opening means the restaurant closes after midnight.
          </ThemedText>
        </View>
      )}
    </View>
  );
}
