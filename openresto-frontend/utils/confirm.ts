import { Alert, Platform } from "react-native";
import i18n from "@/i18n";

/**
 * Asks the diner a yes/no question and resolves to their answer.
 *
 * `window.confirm` is not merely absent on native — `window` exists in React Native without
 * it, so calling it throws rather than falling back to anything. The native side is
 * `Alert.alert`, which is callback-shaped, so the whole thing is a promise and both platforms
 * are awaited the same way. Dismissing the alert (Android's back gesture) counts as "no",
 * matching what a dismissed browser confirm returns.
 *
 * Labels come from `common.actions.*` so the buttons speak the UI language, not the device's.
 *
 * @see [confirm.test.ts](../tests/utils/confirm.test.ts) — pins that both platforms resolve
 * true on accept and false on both cancel and dismiss.
 */
export function confirm(message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(
      message,
      undefined,
      [
        {
          text: i18n.t("common.actions.cancel"),
          style: "cancel",
          onPress: () => resolve(false),
        },
        { text: i18n.t("common.actions.confirm"), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
