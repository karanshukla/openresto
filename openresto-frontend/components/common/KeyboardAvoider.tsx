import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";

/**
 * Lifts a form clear of the on-screen keyboard, off web only.
 *
 * A browser scrolls a focused field into view itself, so on web this renders its children
 * exactly as they were — no extra node, no behaviour change to the live PWA. On a device
 * nothing does that for a form inside a sheet, so the children go inside a
 * `KeyboardAvoidingView`: iOS needs `padding` (the keyboard overlays the window), Android
 * resizes the window itself and needs no behaviour at all.
 *
 * @see [KeyboardAvoider.test.tsx](../../tests/components/common/KeyboardAvoider.test.tsx) —
 * pins the pass-through on web and the per-OS behaviour off it.
 */
export function KeyboardAvoider({
  style,
  children,
}: {
  /** Applied to the avoiding view off web; ignored on web, where there is no view to style. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (Platform.OS === "web") return <>{children}</>;

  return (
    <KeyboardAvoidingView style={style} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}

export default KeyboardAvoider;
