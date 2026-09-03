import { View } from "react-native";
import { haptics } from "@/utils/haptics";
import { IconButton } from "@/components/common/IconButton";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { SelectOption } from "@/components/common/Select";
import { styles } from "./Stepper.styles";

/**
 * A −/value/+ control over the same option list `Select` takes, for picking one value from a
 * short ordered run on a touch screen.
 *
 * It steps by position in `options` rather than by a numeric `step`, so the values it can reach
 * are exactly the ones the dropdown offers on web and the label under the value is the same
 * localized string in both — a stepper carrying its own min/max is how the two controls start
 * offering different party sizes.
 *
 * @see [Stepper.test.tsx](../../tests/components/common/Stepper.test.tsx) — pins that the ends
 * of the list disable their own button, and that a value outside the list disables both.
 */
export default function Stepper({
  options,
  value,
  onChange,
  accessibilityLabel,
  decrementLabel,
  incrementLabel,
  testID,
}: {
  options: SelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  accessibilityLabel: string;
  /** Names the − button. Required for the same reason `IconButton` requires one: it has no text. */
  decrementLabel: string;
  /** Names the + button. */
  incrementLabel: string;
  testID?: string;
}) {
  const { colors, primaryColor } = useAppTheme();

  const index = options.findIndex((o) => o.value === value);
  const label = index === -1 ? String(value) : options[index].label;
  const atStart = index <= 0;
  const atEnd = index === -1 || index >= options.length - 1;

  const step = (delta: number) => {
    const next = options[index + delta];
    if (!next) return;
    haptics.selection();
    onChange(next.value);
  };

  return (
    <View
      style={[styles.container, { borderColor: colors.border, backgroundColor: colors.input }]}
      testID={testID}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: label }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      <IconButton
        name="remove"
        size="xxl"
        color={primaryColor}
        accessibilityLabel={decrementLabel}
        disabled={atStart}
        onPress={() => step(-1)}
      />
      <ThemedText style={styles.value}>{label}</ThemedText>
      <IconButton
        name="add"
        size="xxl"
        color={primaryColor}
        accessibilityLabel={incrementLabel}
        disabled={atEnd}
        onPress={() => step(1)}
      />
    </View>
  );
}
