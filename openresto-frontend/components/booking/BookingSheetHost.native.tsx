import type { ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

/**
 * The two roots `@gorhom/bottom-sheet` needs, mounted once for the whole app.
 *
 * `GestureHandlerRootView` has to wrap everything that uses a gesture handler, and until the
 * booking sheet there was none: the only other consumer is an admin swipe row, and admin is
 * web-only in production, so the app has run without this root the whole time.
 *
 * @see [BookingSheetHost.native.test.tsx](../../tests/components/booking/BookingSheetHost.native.test.tsx)
 * — pins that the gesture root is outermost, since the sheet provider inside it is what
 * renders the sheets and a provider above the root would receive no gestures.
 */
export function BookingSheetHost({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

export default BookingSheetHost;
