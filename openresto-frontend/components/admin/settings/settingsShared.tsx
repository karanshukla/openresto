import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { styles } from "./settingsShared.styles";

/**
 * Shared presentational helpers for the EmailSettingsCard sub-section components.
 */

/** Small uppercase label used to head each sub-section of the email settings card. */
export function SubLabel({ children, mutedColor }: { children: string; mutedColor: string }) {
  return <ThemedText style={[styles.subLabel, { color: mutedColor }]}>{children}</ThemedText>;
}

/** The pill-shaped on/off switch used by the booking-confirmation toggle. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  primaryColor,
  borderColor,
  accessibilityLabel,
  decorative = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  primaryColor: string;
  borderColor: string;
  accessibilityLabel?: string;
  /**
   * Set when an enclosing row already carries the switch semantics — the pill is then
   * only a visual echo of that row's state, and announcing it again would present two
   * nested switches for one setting.
   */
  decorative?: boolean;
}) {
  return (
    <Pressable
      role={decorative ? undefined : "switch"}
      aria-checked={decorative ? undefined : checked}
      accessibilityLabel={decorative ? undefined : accessibilityLabel}
      accessibilityState={decorative ? undefined : { checked, disabled: Boolean(disabled) }}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      focusable={!decorative}
      disabled={disabled}
      onPress={() => !disabled && onChange(!checked)}
      style={[
        styles.track,
        { backgroundColor: checked ? primaryColor : borderColor },
        disabled && styles.trackDisabled,
      ]}
    >
      <View style={[styles.knob, { transform: [{ translateX: checked ? 14 : 0 }] }]} />
    </Pressable>
  );
}
