import { useCallback, useEffect, useRef } from "react";
import { useWindowDimensions } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { NativeSheetProps } from "./NativeSheet";

export type { NativeSheetProps } from "./NativeSheet";

/** The sheet's own scroller, which hands the drag back to the sheet at the top of the list. */
export const SheetScrollView = BottomSheetScrollView;

/** How tall a content-sized sheet may grow before its body scrolls instead. */
const DEFAULT_MAX_HEIGHT_RATIO = 0.88;

/**
 * A panel presented as the platform's own sheet: content-sized, dragged down to dismiss, with
 * the system's rubber-band overscroll and a backdrop that closes.
 *
 * This exists because a hand-rolled `Modal` + `PanResponder` + `Animated` sheet does not drag on
 * a device at all — not by its body and not by its handle — which is how the lookup result panel
 * shipped with no way out but the backdrop. That machinery only ever worked in a browser, where
 * the website still uses it.
 *
 * Sized to its content up to a cap, rather than to fixed detents: a panel that is one short card
 * should not open at three quarters of the display. Past the cap the body scrolls inside it.
 *
 * The bottom inset is the window's, not the tab's. The sheet renders through the portal host in
 * `app/_layout.tsx`, which sits above the navigator, so what it steps over is the home indicator
 * and never a tab bar.
 *
 * @see [NativeSheet.native.test.tsx](../../tests/components/common/NativeSheet.native.test.tsx)
 * — pins that it presents itself, that a dismissal reports upward exactly once, that the
 * backdrop closes rather than merely dimming, and that drag-to-dismiss is on.
 */
export function NativeSheet({
  accessibilityLabel,
  onDismiss,
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  testID,
  children,
}: NativeSheetProps) {
  const sheet = useRef<BottomSheetModal>(null);
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // The parent mounts this the moment there is something to show, so the sheet presents itself
  // rather than making every call site drive a ref.
  useEffect(() => {
    sheet.current?.present();
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
      enableDynamicSizing
      maxDynamicContentSize={height * maxHeightRatio}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.18)",
      }}
      accessibilityLabel={accessibilityLabel}
    >
      {/* The sheet's own scroller, not a plain view: sized to its content the sheet stops
          growing at the cap, and past it the body has to scroll inside rather than be clipped. */}
      <BottomSheetScrollView
        testID={testID}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export default NativeSheet;
