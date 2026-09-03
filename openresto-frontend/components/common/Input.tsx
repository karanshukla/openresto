import { forwardRef, useCallback, useRef } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useScrollFieldIntoView } from "@/components/common/KeyboardAwareScroll";
import { styles } from "./Input.styles";

/**
 * Focus is what asks to be scrolled into view, not the keyboard appearing: moving from one
 * field to the next with the keyboard already up fires no keyboard event, and that is exactly
 * the case where the next field is the one behind it. Inside a `KeyboardAwareScroll` this does
 * something; anywhere else — and on web, where the browser handles it — the hook returns null
 * and this is the same bare input it always was.
 *
 * @see [Input.test.tsx](../../tests/components/common/Input.test.tsx) — pins that focus asks to
 * be revealed and that the caller's own onFocus still runs.
 */
const Input = forwardRef<TextInput, TextInputProps>(function Input(
  { style, onFocus, ...props },
  ref
) {
  const { colors } = useAppTheme();
  const fieldRef = useRef<View>(null);
  const scrollFieldIntoView = useScrollFieldIntoView();

  const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
    (e) => {
      scrollFieldIntoView?.(fieldRef);
      onFocus?.(e);
    },
    [scrollFieldIntoView, onFocus]
  );

  return (
    <View ref={fieldRef} style={styles.container}>
      <TextInput
        ref={ref}
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.input },
          style,
        ]}
        placeholderTextColor={colors.muted}
        onFocus={handleFocus}
        {...props}
      />
    </View>
  );
});

export default Input;
