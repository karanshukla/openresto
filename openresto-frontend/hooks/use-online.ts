import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";

/**
 * Whether the app currently believes it can reach the network.
 *
 * Two sources, because the two platforms answer the question differently: the browser's own
 * `navigator.onLine` plus its `online`/`offline` events on web, and the device's network state
 * off web, where `isInternetReachable` (a captive portal that answers DHCP but nothing else) is
 * a stricter answer than `isConnected` and so wins when the platform supplies it.
 *
 * expo-network is read through its imperative API rather than its `useNetworkState` hook: a
 * hook cannot be called on one platform only, and calling it on web would register a second
 * set of `online`/`offline` listeners behind the ones below to compute a value web never uses.
 *
 * Unknown always resolves to online. This drives a banner and some wording, and telling a diner
 * with a working connection that they have none is worse than saying nothing.
 *
 * @see [use-online.test.ts](../tests/hooks/use-online.test.ts) — pins both platforms, including
 * that the browser events re-render and that the device listener is removed on unmount.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      const read = () => setOnline(navigator.onLine !== false);
      read();
      window.addEventListener("online", read);
      window.addEventListener("offline", read);
      return () => {
        window.removeEventListener("online", read);
        window.removeEventListener("offline", read);
      };
    }

    let mounted = true;
    const apply = (state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }) =>
      setOnline(state.isInternetReachable ?? state.isConnected ?? true);

    getNetworkStateAsync()
      .then((state) => {
        if (mounted) apply(state);
      })
      .catch(() => {});
    const subscription = addNetworkStateListener(apply);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return online;
}
