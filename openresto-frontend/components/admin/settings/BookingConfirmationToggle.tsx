import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { SubLabel, ToggleSwitch } from "./settingsShared";
import { Icon } from "@/components/common/Icon";
import { styles } from "./BookingConfirmationToggle.styles";

export interface BookingConfirmationToggleProps {
  sendConfirmations: boolean;
  confirmDisabled: boolean;
  /** Fired with the next value when the user toggles (parent owns the state + save-msg side-effect). */
  onToggle: (next: boolean) => void;
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
    <View style={styles.wrapper}>
      <SubLabel mutedColor={mutedColor}>Booking confirmations</SubLabel>
      <View
        style={[
          styles.card,
          { borderColor, backgroundColor: surface2 },
          confirmDisabled && styles.cardDisabled,
        ]}
      >
        <Pressable
          onPress={() => {
            if (confirmDisabled) return;
            onToggle(!sendConfirmations);
          }}
          role="switch"
          aria-checked={sendConfirmations}
          accessibilityLabel="Send booking confirmation emails"
          accessibilityState={{ checked: sendConfirmations, disabled: confirmDisabled }}
          style={styles.row}
        >
          <View style={[styles.iconWrap, { backgroundColor: cardBg, borderColor }]}>
            <Icon name="mail-outline" size="sm" color={mutedColor} />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <ThemedText style={styles.title}>Booking confirmation</ThemedText>
              <View style={[styles.badge, { backgroundColor: accentSoft }]} />
            </View>
            <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
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
            decorative
          />
        </Pressable>
        {confirmDisabled && (
          <View style={[styles.hint, { borderTopColor: borderColor, backgroundColor: cardBg }]}>
            <Icon name="shield-outline" size={13} color={mutedColor} />
            <ThemedText style={[styles.hintText, { color: mutedColor }]}>
              Configure and test SMTP above to enable.
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}
