import type { ReactNode } from "react";

/**
 * Mounts whatever the native bottom sheet needs above the app: a gesture-handler root and the
 * portal its sheets render into.
 *
 * This is the **web** implementation and it is a pass-through. The website's sheet is still the
 * hand-rolled `Modal` in `BookingDrawer`, and `@gorhom/bottom-sheet` has no business in the web
 * bundle; Metro resolves the sibling `BookingSheetHost.native.tsx` off web.
 *
 * @see [BookingSheetHost.test.tsx](../../tests/components/booking/BookingSheetHost.test.tsx)
 * — pins that web adds no wrapper of its own.
 */
export function BookingSheetHost({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default BookingSheetHost;
