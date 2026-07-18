import { useRef, useState } from "react";

export interface ConfirmState {
  message: string;
}

export interface UseConfirmResult {
  /** The current confirm state — pass `state` + the handlers to a ConfirmModal. */
  state: ConfirmState | null;
  /** Call to show the confirm dialog; resolves `true` on confirm, `false` on cancel. */
  confirm: (message: string) => Promise<boolean>;
  /** Wire to ConfirmModal's `onConfirm`. */
  handleConfirm: () => void;
  /** Wire to ConfirmModal's `onCancel`. */
  handleCancel: () => void;
}

/**
 * Promise-based confirm-dialog hook for screens that need a one-shot
 * yes/no confirmation before proceeding with an async action.
 *
 * Usage:
 *   const { state, confirm, handleConfirm, handleCancel } = useConfirm();
 *   if (await confirm("Delete this?")) { await doDelete(); }
 *   <ConfirmModal visible={!!state} message={state?.message ?? ""} onConfirm={handleConfirm} onCancel={handleCancel} />
 *
 * Extracted from `app/admin/locations.tsx` where it was inlined as
 * `useConfirmLocal`; the pattern is reusable across admin screens.
 */
export function useConfirm(): UseConfirmResult {
  const [state, setState] = useState<ConfirmState | null>(null);
  // The resolve ref survives re-renders without triggering them.
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message });
    });
  };

  const handleConfirm = () => {
    resolveRef.current?.(true);
    resolveRef.current = null;
    setState(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    resolveRef.current = null;
    setState(null);
  };

  return { state, confirm, handleConfirm, handleCancel };
}
