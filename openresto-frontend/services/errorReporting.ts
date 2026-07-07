export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Centralized error sink. Currently logs to the console with a structured
 * shape (message, stack, context, timestamp) so a future telemetry sink
 * (Sentry / Bugsnag / etc.) can be plugged in here WITHOUT touching call
 * sites — the contract (logError(error, context?)) is fixed.
 *
 * Call sites should prefer this over a bare `console.error` when the error
 * is something a production crash-reporter would want to see.
 */
export function logError(error: unknown, context?: ErrorContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
  };

  // Silent in test to keep output clean. The real sink (when added) replaces
  // this branch and is itself responsible for its own test-env suppression.
  /* istanbul ignore else */
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error("[logError]", entry);
  }
}
