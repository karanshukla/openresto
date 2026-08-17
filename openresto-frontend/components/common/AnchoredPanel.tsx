import { useRef, type ReactNode } from "react";
import { Modal, Pressable, type Role, type View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { webProps, type WebKeyEvent } from "@/utils/webProps";
import type { AnchoredPanel as PanelPosition } from "@/utils/anchoredPanel";
import { backdropStyleFor, panelStyleFor } from "./AnchoredPanel.styles";

export interface AnchoredPanelProps {
  visible: boolean;
  onClose: () => void;
  /** Where to hang the panel, from `useAnchorTracking`. Null renders the centred sheet. */
  position: PanelPosition | null;
  /**
   * Fires once the popup has finished animating away. Releasing the measurement any earlier —
   * in the same handler that closes it — swaps `position` to null while the fade-out is still
   * playing, so the panel tears off its trigger and fades from the middle of the screen as the
   * centred sheet instead.
   */
  onClosed?: () => void;
  /** What the panel is: a list of values (`listbox`) or a set of commands (`menu`). */
  role: Role;
  accessibilityLabel: string;
  /** The DOM id of the highlighted descendant, for a list navigated without moving focus. */
  activeDescendantId?: string;
  id?: string;
  onKeyDown?: (event: WebKeyEvent) => void;
  closeLabel: string;
  backdropTestID?: string;
  testID?: string;
  children: ReactNode;
}

/**
 * The app's one popup-hanging-off-a-trigger. `Select` and the navbar's overflow menu are both
 * this; a third hand-rolled `Modal` positioned by arithmetic is the thing this exists to stop.
 *
 * React Native has no popover primitive, so the mechanics have to live somewhere: a `Modal`
 * (which portals to the document root on web, escaping whatever container the trigger sits in),
 * a full-screen backdrop that closes on a press outside, a panel positioned from the trigger's
 * measured box, focus moved in and restored on close, and the keys forwarded to whoever owns
 * the list.
 *
 * The panel takes focus rather than the options: both controls navigate with
 * `aria-activedescendant`, which keeps one focus target and one keydown handler no matter how
 * many rows are in the list. `tabIndex={-1}` is what makes it focusable without adding it to
 * the tab order.
 *
 * @see [AnchoredPanel.test.tsx](../../tests/components/common/AnchoredPanel.test.tsx) — pins
 * the backdrop dismiss, the key forwarding, and the focus target.
 */
export function AnchoredPanel({
  visible,
  onClose,
  position,
  onClosed,
  role,
  accessibilityLabel,
  activeDescendantId,
  id,
  onKeyDown,
  closeLabel,
  backdropTestID,
  testID,
  children,
}: AnchoredPanelProps) {
  const { colors } = useAppTheme();
  const panelRef = useRef<View>(null);
  useDialogFocus(visible, panelRef);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      onDismiss={onClosed}
    >
      <Pressable
        testID={backdropTestID}
        style={backdropStyleFor(position !== null)}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        // Out of the tab order so the trap inside react-native-web's Modal lands on the panel
        // rather than on the backdrop, where every keystroke would miss the list entirely.
        tabIndex={-1}
      >
        {/*
          The panel swallows its own presses. Without it, anything inside that does not consume
          one — a separator, the padding between rows, a disabled row — reaches the backdrop and
          dismisses the popup, which reads as the control refusing to work.
        */}
        <Pressable
          ref={panelRef}
          testID={testID}
          id={id}
          role={role}
          accessibilityLabel={accessibilityLabel}
          tabIndex={-1}
          onPress={(event) => event?.stopPropagation?.()}
          style={[panelStyleFor(position, colors.border), { backgroundColor: colors.card }]}
          {...webProps({ onKeyDown, "aria-activedescendant": activeDescendantId })}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default AnchoredPanel;
