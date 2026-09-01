import { useCallback, useEffect, useRef, useState } from "react";
import { fetchNativeAppStatus, type NativeAppStatus } from "@/api/nativeApp";

export interface NativeAppStatusState {
  status: NativeAppStatus | null;
  loading: boolean;
  /** The request never landed. Distinct from a loaded status with nothing in it. */
  failed: boolean;
  reload: () => void;
}

/**
 * The one request behind the Native app page. Both the readiness checklist and the client
 * list read the same payload, so the fetch is lifted here rather than run twice: the server
 * reaches out to the deployment's own domain for two of the checks, and a Re-check that
 * refreshed only half the page would leave the two cards describing different moments.
 *
 * @see [use-native-app-status.test.tsx](../tests/hooks/use-native-app-status.test.tsx) — pins
 * that a refused request reports `failed` rather than an empty status, and that reload clears
 * a previous failure.
 */
export function useNativeAppStatus(): NativeAppStatusState {
  const [status, setStatus] = useState<NativeAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const next = await fetchNativeAppStatus();
    if (!mounted.current) return;
    setStatus(next);
    setFailed(next === null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { status, loading, failed, reload };
}
