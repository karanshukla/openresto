import { Platform } from "react-native";
import { configuredApiUrl } from "@/api/client";

/**
 * Where a shared link should point. The brand's website URL first: it is the address the
 * confirmation email, the reminder push and the wallet passes already hand out
 * (`BookingLinks.Confirmation` server-side), so a link from the phone lands on the same page.
 * Without one, web has the page's own origin; a native build has the server it was pointed at,
 * which is the API base minus its `/api` segment — the same host that serves the guest routes.
 */
function siteOrigin(websiteUrl?: string): string | undefined {
  if (websiteUrl) return websiteUrl.replace(/\/+$/, "");

  if (Platform.OS === "web") {
    return typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : undefined;
  }

  const api = configuredApiUrl();
  if (!api) return undefined;
  return api.replace(/\/+$/, "").replace(/\/api$/i, "");
}

/**
 * The URL a guest can manage a booking from, as the server's `BookingLinks.Confirmation`
 * builds it, so a diner sharing from the app and one forwarding the email hand out the same
 * thing. On a native build that host is also the Universal / App Link host, so a recipient
 * with the app installed opens it there and everyone else lands on the web page. Undefined
 * when no origin is known at all — a link to nowhere is worse than no link.
 *
 * @see [bookingLink.test.ts](../tests/utils/bookingLink.test.ts) — pins the website URL
 * winning over the build's server, the `/api` strip, and the escaped reference and email.
 */
export function bookingConfirmationLink(
  bookingRef: string,
  email: string | undefined,
  websiteUrl?: string
): string | undefined {
  const origin = siteOrigin(websiteUrl);
  if (!origin) return undefined;

  const query = email ? `?email=${encodeURIComponent(email)}` : "";
  return `${origin}/booking-confirmation/${encodeURIComponent(bookingRef)}${query}`;
}
