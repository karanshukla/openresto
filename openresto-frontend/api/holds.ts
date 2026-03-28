import { post, del } from "./client";

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

export async function createHold(request: HoldRequest): Promise<HoldResponse | null> {
  try {
    const res = await post("/holds", request);
    if (res.status === 409) return null;
    if (!res.ok) throw new Error("Failed to place hold");
    return await res.json();
  } catch (err) {
    console.error("createHold error:", err);
    return null;
  }
}

export async function releaseHold(holdId: string): Promise<void> {
  try {
    await del(`/holds/${holdId}`);
  } catch {
    console.log("Hold was not released, that's okay...");
  }
}
