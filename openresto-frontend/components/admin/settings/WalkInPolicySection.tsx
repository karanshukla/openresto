import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { DAY_LABELS, DAY_SHORT, modeButton } from "./sectionHelpers";
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
  const modeTheme = { borderColor, mutedColor, textColor, isDark };
  const [expanded, setExpanded] = usePersistedState("locations:walkIn:expanded", true);
  const subtitle = walkInOnly
    ? "Walk-ins only, online booking is off"
    : walkInDays.length > 0
      ? `Walk-ins only on ${walkInDays.length} ${walkInDays.length === 1 ? "day" : "days"}`
      : "Online bookings on every open day";

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon="walk-outline"
        title="Walk-in Policy"
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
              "Online bookings",
              !walkInOnly,
              () => onSetWalkInOnly(false),
              "walkin-mode-bookings",
              modeTheme
            )}
            {modeButton(
              "Walk-ins only",
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
                The location stays listed publicly, but guests can't book online. They'll see a
                walk-in notice instead. Toggle back anytime; nothing is deleted or archived.
              </ThemedText>
            </View>
          ) : (
            <View style={settingsStyles.policyField}>
              <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
                Walk-in only days
              </ThemedText>
              <View style={settingsStyles.dayGrid}>
                {DAY_SHORT.map((label, i) => {
                  const day = i + 1;
                  const active = walkInDays.includes(day);
                  const closed = !openDays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => onToggleWalkInDay(day)}
                      testID={`walkin-day-${day}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${DAY_LABELS[i]}: ${active ? "walk-ins only" : "online bookings"}. Tap to toggle.`}
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
                Highlighted days stay open but only take walk-ins. The booking form is disabled for
                those dates. Dimmed days are currently marked closed.
              </ThemedText>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
