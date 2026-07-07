import { useEffect } from "react";
import type { ErrorBoundaryProps } from "expo-router";
import { useRouter } from "expo-router";
import ErrorScreen from "@/components/common/ErrorScreen";
import { logError } from "@/services/errorReporting";

/**
 * Root error boundary — Expo Router renders this fallback whenever any route
 * in the tree throws during render (and no nearer boundary catches it first).
 *
 * `logError` runs in an effect (not in render) so it fires once per error
 * change and stays out of React's commit phase. The raw error.message is
 * shown in dev/test for debugging; production shows the generic message so
 * internals never leak to end users.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const router = useRouter();

  useEffect(() => {
    logError(error, { boundary: "root-error-boundary" });
  }, [error]);

  return (
    <ErrorScreen
      message={process.env.NODE_ENV !== "production" ? error.message : undefined}
      retry={() => {
        void retry();
      }}
      onGoHome={() => router.replace("/")}
    />
  );
}
