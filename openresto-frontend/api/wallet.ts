import { buildUrl, get } from "./client";

/**
 * The signed `.pkpass` for a booking. A URL rather than bytes: Safari adds a pass to Wallet
 * when navigated to one, and the native app downloads it to hand to the share sheet.
 */
export function appleWalletPassUrl(bookingRef: string, email: string): string {
  return buildUrl(
    `/bookings/ref/${encodeURIComponent(bookingRef)}/wallet/apple.pkpass?email=${encodeURIComponent(email)}`
  );
}

/**
 * The "Save to Google Wallet" link for a booking, or null when the server could not issue one
 * (not configured, wrong reference/email, or cancelled).
 *
 * @see [wallet.test.ts](../tests/api/wallet.test.ts) — pins the null on a non-2xx.
 */
export async function fetchGoogleWalletSaveUrl(
  bookingRef: string,
  email: string
): Promise<string | null> {
  try {
    const res = await get(
      `/bookings/ref/${encodeURIComponent(bookingRef)}/wallet/google?email=${encodeURIComponent(email)}`
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { saveUrl?: unknown };
    return typeof body.saveUrl === "string" && body.saveUrl ? body.saveUrl : null;
  } catch (err) {
    console.error("fetchGoogleWalletSaveUrl error:", err);
    return null;
  }
}
