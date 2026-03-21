const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

export interface HoldRequest {
  restaurantId: number;
  tableId: number;
  sectionId: number;
  date: string; // ISO 8601
}

export interface HoldResponse {
  holdId: string;
  expiresAt: string; // ISO 8601
  secondsRemaining: number;
}

/**
 * Requests a temporary hold on a table for the given date/time.
 * Returns the hold details if successful, or null if the table is already held.
 */
export async function createHold(
  request: HoldRequest
): Promise<HoldResponse | null> {
  try {
    const res = await fetch(buildEndpoint("/holds"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (res.status === 409) return null; // held by someone else
    if (!res.ok) throw new Error("Failed to place hold");

    return await res.json();
  } catch (err) {
    console.error("createHold error:", err);
    return null;
  }
}

/**
 * Releases a hold early (e.g., when the user navigates away).
 * Fire-and-forget — the hold will expire on its own if this fails.
 */
export async function releaseHold(holdId: string): Promise<void> {
  try {
    await fetch(buildEndpoint(`/holds/${holdId}`), { method: "DELETE" });
  } catch {
    // Intentionally ignored — hold will expire via TTL
  }
}
