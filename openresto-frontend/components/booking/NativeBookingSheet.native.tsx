import { useCallback, useEffect, useRef } from "react";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { haptics } from "@/utils/haptics";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { NativeBookingSheetProps } from "./NativeBookingSheet";

export type { NativeBookingSheetProps } from "./NativeBookingSheet";

/** The sheet's own scroller, which hands the drag back to the sheet at the top of the list. */
export const SheetScrollView = BottomSheetScrollView;

/**
 * Two detents: enough of the form to fill in without moving, and near-full for the seating
 * picker. The guest lands on the first.
 */
const DETENTS = ["66%", "92%"];

/**
 * The booking form as the platform's own sheet, replacing a hand-rolled
 * `Modal` + `PanResponder` + `Animated` that had no detents, no rubber-band overscroll, and
 * left the keyboard to a `KeyboardAvoidingView` wrapper rather than resizing the sheet (#425).
 *
 * The drawer stays a component with the same props rather than becoming a pushed route: party
 * size, date and location are two-way bindings to the list behind it, and a route would have
 * to rebuild that channel through params.
 *
 * @see [NativeBookingSheet.native.test.tsx](../../tests/components/booking/NativeBookingSheet.native.test.tsx)
 * — pins the detents, that a dismissal reports upward exactly once, and that the backdrop
 * closes rather than merely dimming.
 */
export function NativeBookingSheet({
  accessibilityLabel,
  onClose,
  children,
}: NativeBookingSheetProps) {
  const sheet = useRef<BottomSheetModal>(null);
  const { colors, isDark } = useAppTheme();

  // The parent mounts this the moment a location is picked, so the sheet presents itself
  // rather than making every call site drive a ref.
  useEffect(() => {
    sheet.current?.present();
  }, []);

  const dismiss = useCallback(() => {
    haptics.selection();
    sheet.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheet}
      snapPoints={DETENTS}
      // Explicit detents, so the sheet must not also try to size itself to its content.
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={onClose}
      // Resize the sheet around the keyboard instead of shoving the whole thing up, which is
      // the half of this the KeyboardAvoidingView wrapper could never do.
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.18)",
      }}
      accessibilityLabel={accessibilityLabel}
    >
      {children({ dismiss })}
    </BottomSheetModal>
  );
}

export default NativeBookingSheet;
