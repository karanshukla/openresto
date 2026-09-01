import { get } from "./client";

/** One row of the admin's native-app readiness checklist. Ids are fixed; the UI translates them. */
export type NativeAppCheckId =
  "https" | "brandIcon" | "privacyPolicy" | "appleAppSiteAssociation" | "androidAssetLinks";

export type NativeAppCheckStatus = "pass" | "fail" | "skip";

export interface NativeAppCheck {
  id: NativeAppCheckId;
  status: NativeAppCheckStatus;
  /** Server-side explanation of the result, e.g. the HTTP status and content type it saw. */
  detail: string | null;
  /** The URL the check fetched, when it fetched one. */
  url: string | null;
}

/** Aggregate use of one native build: no device ids, no addresses, just counts. */
export interface NativeAppClient {
  platform: string;
  appVersion: string;
  lastSeenUtc: string;
  requestsLast7Days: number;
  requestsLast30Days: number;
}

export interface NativeAppStatus {
  /** The public address the checks ran against, or null when the server has none configured. */
  serverUrl: string | null;
  checks: NativeAppCheck[];
  minimumAppVersion: string | null;
  clients: NativeAppClient[];
}

/** Null means the request never landed or was refused; callers show a load error, not an empty page. */
export async function fetchNativeAppStatus(): Promise<NativeAppStatus | null> {
  try {
    const res = await get("/admin/native-app/status");
    if (!res.ok) return null;
    return (await res.json()) as NativeAppStatus;
  } catch {
    return null;
  }
}
