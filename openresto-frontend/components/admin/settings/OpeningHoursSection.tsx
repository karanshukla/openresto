import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import TimePicker from "@/components/common/TimePicker";
import { DAY_LABELS, DAY_SHORT, modeButton } from "./sectionHelpers";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./OpeningHoursSection.styles";
import { Icon } from "@/components/common/Icon";

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
    <View style={[settingsStyles.policyCard, { borderColor, backgroundColor: surface2 }]}>
      <View style={settingsStyles.policyHeader}>
        <View style={settingsStyles.policyHeaderCopy}>
          <ThemedText style={settingsStyles.policyTitle}>Opening hours</ThemedText>
          <ThemedText style={[settingsStyles.policySub, { color: mutedColor }]}>
            {openDays.length} of 7 days open
          </ThemedText>
        </View>
        <View
          style={[
            settingsStyles.policyModeGroup,
            { backgroundColor: isDark ? "#1b1d1f" : "#eef0f2" },
          ]}
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
          <View style={styles.uniformTimes}>
            <View style={styles.uniformTimeField}>
              <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                Opens
              </ThemedText>
              <TimePicker
                selectedTime={openTime}
                onSelect={onSetOpenTime}
                minTime="00:00"
                maxTime="23:45"
              />
            </View>
            <View style={styles.uniformTimeField}>
              <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                Closes
              </ThemedText>
              <TimePicker
                selectedTime={closeTime}
                onSelect={onSetCloseTime}
                minTime="00:00"
                maxTime="23:45"
              />
            </View>
          </View>

          <View style={settingsStyles.policyField}>
            <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
              Open days
            </ThemedText>
            <View style={settingsStyles.dayGrid}>
              {DAY_LABELS.map((label, i) => {
                const day = i + 1;
                const active = openDays.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => onToggleDay(day)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      settingsStyles.dayBtn,
                      {
                        backgroundColor: active ? primaryColor : cardBg,
                        borderColor: active ? primaryColor : borderColor,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[settingsStyles.dayBtnLabel, { color: active ? "#fff" : textColor }]}
                    >
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
              Tap a day to mark it open or closed.
            </ThemedText>
          </View>
        </>
      ) : (
        <View style={styles.perDayList}>
          {DAY_SHORT.map((label, i) => {
            const day = i + 1;
            const active = openDays.includes(day);
            const hours = weekHours[day];
            return (
              <View key={day} style={[styles.perDayRow, !active && styles.perDayRowClosed]}>
                <Pressable
                  onPress={() => onToggleDay(day)}
                  testID={`day-toggle-${day}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${DAY_LABELS[i]}: ${active ? "open" : "closed"}. Tap to toggle.`}
                  style={[
                    styles.dayChip,
                    {
                      backgroundColor: active ? primaryColor : cardBg,
                      borderColor: active ? primaryColor : borderColor,
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.dayChipLabel, { color: active ? "#fff" : mutedColor }]}
                  >
                    {label}
                  </ThemedText>
                </Pressable>

                {active ? (
                  <>
                    <View style={styles.timeField}>
                      <TimePicker
                        selectedTime={hours.open}
                        onSelect={(t) => onSetDayHours(day, { open: t })}
                        minTime="00:00"
                        maxTime="23:45"
                      />
                    </View>
                    <ThemedText style={[styles.timeSeparator, { color: mutedColor }]}>–</ThemedText>
                    <View style={styles.timeField}>
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
                      style={(state) => [
                        styles.copyBtn,
                        {
                          borderColor: (state as { hovered?: boolean }).hovered
                            ? primaryColor
                            : borderColor,
                          backgroundColor: cardBg,
                        },
                      ]}
                    >
                      <Icon name="copy-outline" size="sm" color={mutedColor} />
                    </Pressable>
                  </>
                ) : (
                  <ThemedText style={[styles.closedLabel, { color: mutedColor }]}>
                    Closed
                  </ThemedText>
                )}
              </View>
            );
          })}
          <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
            Tap a day to mark it open or closed. Use{" "}
            <Icon name="copy-outline" size={11} color={mutedColor} /> to apply one day's hours to
            the whole week.
          </ThemedText>
        </View>
      )}

      {anyOvernight && (
        <View style={settingsStyles.policyNote}>
          <Icon name="moon-outline" size="xs" color={mutedColor} />
          <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
            A closing time at or before opening means the restaurant closes after midnight.
          </ThemedText>
        </View>
      )}
    </View>
  );
}
