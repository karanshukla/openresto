import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { SubLabel, ToggleSwitch } from "./settingsShared";

export interface BookingConfirmationToggleProps {
  sendConfirmations: boolean;
  confirmDisabled: boolean;
  /** Fired with the next value when the user toggles (parent owns the state + save-msg side-effect). */
  onToggle: (next: boolean) => void;
  // Theme values (presentational).
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  cardBg: string;
  surface2: string;
  accentSoft: string;
}

/**
 * The "Booking confirmation" toggle card in the EmailSettingsCard right column — icon + title +
 * description + the on/off switch, plus a "Configure and test SMTP above to enable" hint when the
 * toggle is disabled. Presentational: receives the current value + a single onToggle callback.
 * Extracted during Bundle 9B-2 decomposition.
 */
export function BookingConfirmationToggle({
  sendConfirmations,
  confirmDisabled,
  onToggle,
  borderColor,
  mutedColor,
  primaryColor,
  cardBg,
  surface2,
  accentSoft,
}: BookingConfirmationToggleProps) {
  return (
    <View style={{ gap: 8 }}>
      <SubLabel mutedColor={mutedColor}>Booking confirmations</SubLabel>
      <View
        style={[
          {
            borderWidth: 1,
            borderColor,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: surface2,
          },
          confirmDisabled && { opacity: 0.65 },
        ]}
      >
        <Pressable
          onPress={() => {
            if (confirmDisabled) return;
            onToggle(!sendConfirmations);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            padding: 12,
            paddingHorizontal: 14,
          }}
        >
          {/* Icon box */}
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="mail-outline" size={14} color={mutedColor} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: "500" }}>
                Booking confirmation
              </ThemedText>
              <View
                style={{
                  backgroundColor: accentSoft,
                  borderRadius: 999,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}
              />
            </View>
            <ThemedText style={{ fontSize: 12.5, color: mutedColor, marginTop: 2 }}>
              Sent the moment a guest books a table.
            </ThemedText>
          </View>
          <ToggleSwitch
            checked={sendConfirmations}
            onChange={(v) => {
              if (confirmDisabled) return;
              onToggle(v);
            }}
            disabled={confirmDisabled}
            primaryColor={primaryColor}
            borderColor={borderColor}
          />
        </Pressable>
        {confirmDisabled && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              padding: 10,
              paddingHorizontal: 14,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              backgroundColor: cardBg,
            }}
          >
            <Ionicons name="shield-outline" size={13} color={mutedColor} />
            <ThemedText style={{ fontSize: 12, color: mutedColor }}>
              Configure and test SMTP above to enable.
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}
