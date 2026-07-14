import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { DAY_LABELS, DAY_SHORT, modeButton } from "./sectionHelpers";
import { styles } from "./settings.styles";

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
  surface2: string;
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
  surface2,
  isDark,
}: WalkInPolicySectionProps) {
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
          <ThemedText style={{ fontSize: 13, fontWeight: "600" }}>Reservations</ThemedText>
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            {walkInOnly
              ? "Walk-ins only, online booking is off"
              : walkInDays.length > 0
                ? `Walk-ins only on ${walkInDays.length} ${walkInDays.length === 1 ? "day" : "days"}`
                : "Online bookings on every open day"}
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
      </View>

      {walkInOnly ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="walk-outline" size={12} color={mutedColor} />
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            The location stays listed publicly, but guests can't book online. They'll see a walk-in
            notice instead. Toggle back anytime; nothing is deleted or archived.
          </ThemedText>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>
            Walk-in only days
          </ThemedText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                    opacity: closed ? 0.55 : 1,
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
            Highlighted days stay open but only take walk-ins. The booking form is disabled for
            those dates. Dimmed days are currently marked closed.
          </ThemedText>
        </View>
      )}
    </View>
  );
}
