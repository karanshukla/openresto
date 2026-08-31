import { Platform } from "react-native";

/**
 * Writes `text` to the system clipboard and answers whether the write actually landed.
 *
 * Both failure modes are silent, which is why the answer is a boolean rather than a fire-and-
 * forget: `navigator.clipboard` is undefined outside a secure context — which includes the
 * documented `http://localhost:5062` self-host install — and `writeText` rejects when the
 * document isn't focused or the permission is denied.
 *
 * @see [clipboard.test.ts](../../../tests/components/admin/settings/clipboard.test.ts) — pins
 * that a missing clipboard API, a rejected write and empty text each report failure, and only
 * a resolved write reports success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== "web" || !text) return false;
  if (!navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** How long a successful copy stays confirmed before the control returns to its resting label. */
export const COPY_CONFIRMATION_MS = 2000;
