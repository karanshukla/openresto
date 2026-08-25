import { View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { getDayLabels, getDayShort, modeButton } from "./sectionHelpers";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./WalkInPolicySection.styles";
import { Icon } from "@/components/common/Icon";

export interface WalkInPolicySectionProps {
  walkInOnly: boolean;
  walkInDays: number[];
  openDays: number[];
  // Callbacks — the parent (RestaurantInfoForm) owns the state.
  onSetWalkInOnly: (v: boolean) => void;
  onToggleWalkInDay: (day: number) => void;
  // Theme values (presentational).
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  cardBg: string;
  textColor: string;
  isDark: boolean;
}

/**
 * The "Reservations / walk-in policy" section of RestaurantInfoForm — online-bookings vs
 * walk-ins-only mode toggle, plus the walk-in-only-days selector. Presentational: receives all
 * state + setters as props, owns no data fetching. Extracted during Bundle 9B-1 decomposition.
 */
export function WalkInPolicySection({
  walkInOnly,
  walkInDays,
  openDays,
  onSetWalkInOnly,
  onToggleWalkInDay,
  borderColor,
  mutedColor,
  primaryColor,
  cardBg,
  textColor,
  isDark,
}: WalkInPolicySectionProps) {
  const { t } = useTranslation();
  const modeTheme = { borderColor, mutedColor, textColor, isDark };
  const [expanded, setExpanded] = usePersistedState("locations:walkIn:expanded", true);
  const dayLabels = getDayLabels(t);
  const dayShort = getDayShort(t);
  const subtitle = walkInOnly
    ? t("admin.settings.walkInPolicy.subtitleWalkInOnly")
    : walkInDays.length > 0
      ? t("admin.settings.walkInPolicy.subtitleWalkInDays", { count: walkInDays.length })
      : t("admin.settings.walkInPolicy.subtitleOnline");

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon="walk-outline"
        title={t("admin.settings.walkInPolicy.title")}
        subtitle={subtitle}
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
              t("admin.settings.walkInPolicy.modeOnline"),
              !walkInOnly,
              () => onSetWalkInOnly(false),
              "walkin-mode-bookings",
              modeTheme
            )}
            {modeButton(
              t("admin.settings.walkInPolicy.modeWalkInOnly"),
              walkInOnly,
              () => onSetWalkInOnly(true),
              "walkin-mode-walkin",
              modeTheme
            )}
          </View>

          {walkInOnly ? (
            <View style={settingsStyles.policyNote}>
              <Icon name="walk-outline" size="xs" color={mutedColor} />
              <ThemedText style={[settingsStyles.policyHint, { color: mutedColor }]}>
                {t("admin.settings.walkInPolicy.walkInOnlyHint")}
              </ThemedText>
            </View>
          ) : (
            <View style={settingsStyles.policyField}>
              <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                {t("admin.settings.walkInPolicy.walkInDaysLabel")}
              </ThemedText>
              <View style={settingsStyles.dayGrid}>
                {dayShort.map((label, i) => {
                  const day = i + 1;
                  const active = walkInDays.includes(day);
                  const closed = !openDays.includes(day);
                  const dayState = active
                    ? t("admin.settings.walkInPolicy.dayStateWalkInOnly")
                    : t("admin.settings.walkInPolicy.dayStateOnlineBookings");
                  return (
                    <Pressable
                      key={day}
                      onPress={() => onToggleWalkInDay(day)}
                      testID={`walkin-day-${day}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t("admin.settings.walkInPolicy.dayToggleLabel", {
                        day: dayLabels[i],
                        state: dayState,
                      })}
                      style={[
                        settingsStyles.dayBtn,
                        {
                          backgroundColor: active ? primaryColor : cardBg,
                          borderColor: active ? primaryColor : borderColor,
                        },
                        closed && styles.dayBtnClosed,
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
                {t("admin.settings.walkInPolicy.walkInDaysHint")}
              </ThemedText>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
