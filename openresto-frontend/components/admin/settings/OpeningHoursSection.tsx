import { View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import TimePicker from "@/components/common/TimePicker";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { getDayLabels, getDayShort, modeButton } from "./sectionHelpers";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
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
  isDark,
}: OpeningHoursSectionProps) {
  const { t } = useTranslation();
  const modeTheme = { borderColor, mutedColor, textColor, isDark };
  const [expanded, setExpanded] = usePersistedState("locations:hours:expanded", true);
  const dayLabels = getDayLabels(t);
  const dayShort = getDayShort(t);
  const modeUniformLabel = t("admin.settings.openingHours.modeUniform");
  const modeCustomLabel = t("admin.settings.openingHours.modeCustom");

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon="time-outline"
        title={t("admin.settings.openingHours.title")}
        subtitle={t("admin.settings.openingHours.subtitle", {
          count: openDays.length,
          mode: customHours ? modeCustomLabel : modeUniformLabel,
        })}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }]}>
          <View
            style={[
              settingsStyles.policyModeGroup,
              styles.modeGroupStandalone,
              { backgroundColor: isDark ? "#1b1d1f" : "#eef0f2" },
            ]}
          >
            {modeButton(
              modeUniformLabel,
              !customHours,
              () => onSetCustomHours(false),
              "hours-mode-uniform",
              modeTheme
            )}
            {modeButton(
              modeCustomLabel,
              customHours,
              () => onSetCustomHours(true),
              "hours-mode-custom",
              modeTheme
            )}
          </View>

          {!customHours ? (
            <>
              <View style={styles.uniformTimes}>
                <View style={styles.uniformTimeField}>
                  <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                    {t("admin.settings.openingHours.opensLabel")}
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
                    {t("admin.settings.openingHours.closesLabel")}
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
                  {t("admin.settings.openingHours.openDaysLabel")}
                </ThemedText>
                <View style={settingsStyles.dayGrid}>
                  {dayLabels.map((label, i) => {
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
                          style={[
                            settingsStyles.dayBtnLabel,
                            { color: active ? "#fff" : textColor },
                          ]}
                        >
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
                  {t("admin.settings.openingHours.tapDayHint")}
                </ThemedText>
              </View>
            </>
          ) : (
            <View style={styles.perDayList}>
              {dayShort.map((label, i) => {
                const day = i + 1;
                const active = openDays.includes(day);
                const hours = weekHours[day];
                const dayState = active
                  ? t("admin.settings.openingHours.dayStateOpen")
                  : t("admin.settings.openingHours.dayStateClosed");
                return (
                  <View key={day} style={[styles.perDayRow, !active && styles.perDayRowClosed]}>
                    <Pressable
                      onPress={() => onToggleDay(day)}
                      testID={`day-toggle-${day}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t("admin.settings.openingHours.dayToggleLabel", {
                        day: dayLabels[i],
                        state: dayState,
                      })}
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
                        <ThemedText style={[styles.timeSeparator, { color: mutedColor }]}>
                          –
                        </ThemedText>
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
                          accessibilityLabel={t("admin.settings.openingHours.copyHoursLabel", {
                            day: dayLabels[i],
                          })}
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
                        {t("admin.settings.openingHours.closedLabel")}
                      </ThemedText>
                    )}
                  </View>
                );
              })}
              <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
                {t("admin.settings.openingHours.copyHint")}
              </ThemedText>
            </View>
          )}

          {anyOvernight && (
            <View style={settingsStyles.policyNote}>
              <Icon name="moon-outline" size="xs" color={mutedColor} />
              <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
                {t("admin.settings.openingHours.overnightHint")}
              </ThemedText>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
