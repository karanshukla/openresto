import { useCallback, useState } from "react";

export interface UseErrorHandlerResult {
  /** The current error message, or null when no error is showing. */
  errorMessage: string | null;
  /** Show an error to the user. Accepts an Error, a string, or anything String()-able. */
  showError: (error: unknown) => void;
  /** Dismiss the current error. */
  clearError: () => void;
}

/**
 * Standardizes how action failures surface to the user. Replaces the
 * window.alert / Alert.alert platform-split pattern with one path: a screen
 * calls showError(err), then renders <AlertModal visible={errorMessage !== null}
 * message={errorMessage ?? ""} onClose={clearError} />. (Bundle 12.)
 *
 * The extraction of `instanceof Error ? .message : String(error)` matches the
 * exact derivation the three call sites previously inlined, so error text is
 * byte-for-byte identical after rewiring.
 */
export function useErrorHandler(): UseErrorHandlerResult {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showError = useCallback((error: unknown) => {
    setErrorMessage(error instanceof Error ? error.message : String(error));
  }, []);

  const clearError = useCallback(() => setErrorMessage(null), []);

  return { errorMessage, showError, clearError };
}
