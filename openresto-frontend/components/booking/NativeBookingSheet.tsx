import { ScrollView } from "react-native";
import type { ReactNode } from "react";

/**
 * The scroll container the sheet body renders into. On native it has to be the sheet's own,
 * so dragging the list and dragging the sheet do not fight; on web it is a plain ScrollView.
 */
export const SheetScrollView = ScrollView;

export interface NativeBookingSheetProps {
  accessibilityLabel: string;
  /** Called once the sheet has finished animating away, or been dismissed by gesture. */
  onClose: () => void;
  /** Receives the sheet's own dismiss, so the header's close button animates out natively. */
  children: (controls: { dismiss: () => void }) => ReactNode;
}

/**
 * Never rendered on web: `BookingDrawer` keeps its hand-rolled sheet there, because a browser
 * has no platform sheet to defer to and the website must not carry `@gorhom/bottom-sheet`.
 * Metro resolves the sibling `.native.tsx` off web. Present only so the import typechecks.
 */
export function NativeBookingSheet({ children }: NativeBookingSheetProps) {
  return <>{children({ dismiss: () => {} })}</>;
}

export default NativeBookingSheet;
