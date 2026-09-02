import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { openExternal } from "@/utils/openExternal";

export const PKPASS_MIME = "application/vnd.apple.pkpass";
export const PKPASS_UTI = "com.apple.pkpass";

/**
 * Hands the diner their Apple Wallet pass. Safari adds a pass to Wallet when navigated to a
 * `.pkpass`, so web just opens the URL; the native app has no such handler and instead
 * downloads the file and offers it to the share sheet, where "Add to Wallet" is the first row.
 *
 * The cache directory for the same reason `deliverIcs` uses it: once Wallet has the pass the
 * file is spent.
 *
 * @see [wallet.test.ts](../tests/utils/wallet.test.ts) — pins the open on web and the
 * download-then-share off it.
 */
export async function deliverApplePass(url: string, bookingRef: string): Promise<void> {
  if (Platform.OS === "web") {
    openExternal(url);
    return;
  }
  const destination = new File(Paths.cache, `reservation-${bookingRef}.pkpass`);
  const file = await File.downloadFileAsync(url, destination, { idempotent: true });
  await Sharing.shareAsync(file.uri, { mimeType: PKPASS_MIME, UTI: PKPASS_UTI });
}

/** Google's save link is a web page on every platform; the phone routes it to the Wallet app itself. */
export function openGoogleWalletSave(saveUrl: string): void {
  openExternal(saveUrl);
}
