import { get, put } from "./client";
import { apiErrorMessage } from "@/api/errors";

export type EmbedOriginsResult = { ok: true; origins: string[] } | { ok: false; message: string };

/** The sites allowed to frame the booking widget, or null when the request failed. */
export async function getEmbedOrigins(): Promise<string[] | null> {
  try {
    const res = await get("/admin/embed-settings");
    if (!res.ok) return null;
    const body: { allowedOrigins: string[] } = await res.json();
    return body.allowedOrigins;
  } catch {
    return null;
  }
}

/** Replaces the whole list; the server answers with each origin in its canonical form. */
export async function saveEmbedOrigins(origins: string[]): Promise<EmbedOriginsResult> {
  try {
    const res = await put("/admin/embed-settings", { allowedOrigins: origins });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: apiErrorMessage(body, "Request failed.") };
    return { ok: true, origins: body.allowedOrigins };
  } catch {
    return { ok: false, message: "Network error." };
  }
}
