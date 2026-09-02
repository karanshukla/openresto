export interface QuickActionOptions {
  /**
   * Label shown under the app icon, already localized. Registering at runtime rather than
   * declaring the action in the config plugin is what lets it follow the guest's chosen
   * language: a static action's title is frozen in whatever locale the publisher built in.
   */
  title: string;
  /** Called when the app is launched, or resumed, from the action. */
  onSelect: () => void;
}

/**
 * Publishes the app's home-screen quick actions and listens for launches from them, returning
 * a teardown.
 *
 * This is the **web** implementation and it is inert: a browser has no app icon to long-press.
 * Native resolves the sibling `quickActions.native.ts` through Metro's platform extensions,
 * which keeps expo-quick-actions out of the web bundle.
 *
 * @see [quickActions.test.ts](../tests/services/quickActions.test.ts) — pins that web
 * registers nothing and hands back a teardown that is safe to call.
 */
export function registerQuickActions(_options: QuickActionOptions): () => void {
  return () => {};
}
