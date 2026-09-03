import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { HoldStatus } from "./useTableHold";

/**
 * Everything the docked confirm needs, as primitives plus two stable callbacks. Deliberately
 * not a rendered node: a node's identity changes every render, and publishing that from an
 * effect would re-render the drawer on every keystroke in the form.
 */
export interface BookingDockState {
  holdStatus: HoldStatus;
  secondsLeft: number;
  hasSelection: boolean;
  holdMessage?: string | null;
  disabled: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onRefresh?: () => void;
}

interface BookingDockChannel {
  dock: BookingDockState | null;
  publish: (dock: BookingDockState | null) => void;
}

const BookingDockContext = createContext<BookingDockChannel | null>(null);

/**
 * Carries the booking form's submit out to whatever is hosting it, so the confirm can be docked
 * to the bottom of the sheet instead of living at the end of a scroll the guest has to reach.
 *
 * The form is rendered inside the sheet's scroller, and React Native has no portal, so the only
 * way for a pinned footer to show the form's own state is for the form to publish it. Same shape
 * as `BrandDraftContext`, where the cards publish unsaved values for the preview beside them.
 *
 * A host that does not mount this gets `useBookingDock() === null`, and the form keeps its
 * confirm inline — which is exactly what the website does.
 *
 * @see [BookingDockContext.test.tsx](../../tests/components/booking/BookingDockContext.test.tsx)
 * — pins that a publish reaches the host and that unmounting clears it.
 */
export function BookingDockProvider({ children }: { children: ReactNode }) {
  const [dock, setDock] = useState<BookingDockState | null>(null);
  const value = useMemo<BookingDockChannel>(() => ({ dock, publish: setDock }), [dock]);

  return <BookingDockContext.Provider value={value}>{children}</BookingDockContext.Provider>;
}

/** The published submit, or null where nothing is hosting a dock. */
export function useBookingDock(): BookingDockState | null {
  return useContext(BookingDockContext)?.dock ?? null;
}

/** Whether a dock is being hosted at all, which is what tells the form to give up its confirm. */
export function useHasBookingDock(): boolean {
  return useContext(BookingDockContext) !== null;
}

/**
 * Publishes the form's submit to the host, and withdraws it when the form goes away — a footer
 * left holding a submit for an unmounted form would still be pressable.
 *
 * Every field is a dependency by hand rather than the object, which is a fresh literal on each
 * render; the two callbacks have to be stable at the call site for the same reason.
 */
export function usePublishBookingDock(dock: BookingDockState | null) {
  const channel = useContext(BookingDockContext);
  const publish = channel?.publish;

  const { holdStatus, secondsLeft, hasSelection, holdMessage, disabled, submitting } = dock ?? {};
  const onSubmit = dock?.onSubmit;
  const onRefresh = dock?.onRefresh;

  useEffect(() => {
    if (!publish) return;
    publish(
      onSubmit
        ? {
            holdStatus: holdStatus as HoldStatus,
            secondsLeft: secondsLeft as number,
            hasSelection: hasSelection as boolean,
            holdMessage,
            disabled: disabled as boolean,
            submitting: submitting as boolean,
            onSubmit,
            onRefresh,
          }
        : null
    );
    return () => publish(null);
  }, [
    publish,
    holdStatus,
    secondsLeft,
    hasSelection,
    holdMessage,
    disabled,
    submitting,
    onSubmit,
    onRefresh,
  ]);
}

export default BookingDockProvider;
