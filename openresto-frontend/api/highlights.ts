import { get } from "./client";

export interface HighlightDto {
  id: number;
  title: string;
  body: string;
  iconKey: string;
  sortOrder: number;
  link?: string | null;
}

export async function fetchHighlights(): Promise<HighlightDto[]> {
  try {
    const res = await get("/highlights");
    if (!res.ok) throw new Error("Failed to fetch highlights");
    return await res.json();
  } catch (err) {
    console.error("fetchHighlights error:", err);
    return [];
  }
}
