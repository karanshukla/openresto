import { ScrollView } from "react-native";
import type { ReactNode } from "react";

/**
 * The scroll container the sheet body renders into. On native it has to be the sheet's own, so
 * dragging the list and dragging the sheet do not fight; on web it is a plain ScrollView.
 */
export const SheetScrollView = ScrollView;

export interface NativeSheetProps {
  accessibilityLabel: string;
  /** Called once the sheet has finished animating away, however it was dismissed. */
  onDismiss: () => void;
  /**
   * How tall the sheet may grow before its body starts scrolling, as a fraction of the window.
   * The sheet sizes itself to its content below that.
   */
  maxHeightRatio?: number;
  testID?: string;
  children: ReactNode;
}

/**
 * Never rendered on web: the website keeps its hand-rolled sheet, because a browser has no
 * platform sheet to defer to and the site must not carry `@gorhom/bottom-sheet`. Metro resolves
 * the sibling `.native.tsx` off web. Present only so the import typechecks.
 */
export function NativeSheet({ children }: NativeSheetProps) {
  return <>{children}</>;
}

export default NativeSheet;
