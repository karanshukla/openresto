import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";

/**
 * Shared presentational helpers for the EmailSettingsCard sub-section components.
 * Extracted from the original monolithic card during Bundle 9B-2 decomposition.
 */

/** Small uppercase label used to head each sub-section of the email settings card. */
export function SubLabel({ children, mutedColor }: { children: string; mutedColor: string }) {
  return (
    <ThemedText
      style={{
        fontSize: 10,
        textTransform: "uppercase" as const,
        letterSpacing: 1,
        color: mutedColor,
        fontWeight: "600" as const,
        marginBottom: 10,
      }}
    >
      {children}
    </ThemedText>
  );
}

/** The pill-shaped on/off switch used by the booking-confirmation toggle. */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  primaryColor,
  borderColor,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  primaryColor: string;
  borderColor: string;
}) {
  return (
    <Pressable
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onPress={() => !disabled && onChange(!checked)}
      style={[
        {
          width: 34,
          height: 20,
          borderRadius: 999,
          backgroundColor: checked ? primaryColor : borderColor,
          padding: 2,
          justifyContent: "center" as const,
          flexShrink: 0,
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: "white",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.18,
          shadowRadius: 1,
          transform: [{ translateX: checked ? 14 : 0 }],
        }}
      />
    </Pressable>
  );
}
