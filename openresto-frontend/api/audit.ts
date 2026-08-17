import { get } from "./client";

/**
 * One recorded field change. A protected field arrives with its value already masked as the
 * literal `REDACTED_MARKER` (see `@/utils/audit`) — the client never sees the real value.
 */
export interface AuditChangeDto {
  field: string;
  before: string | null;
  after: string | null;
}

/** A single admin action, as returned by the Owner-only activity trail. */
export interface AdminAuditEntryDto {
  id: number;
  occurredAt: string;
  actorUserId: number | null;
  actorEmail: string;
  actorDisplayName: string | null;
  actorRole: string;
  /** Dotted `noun.verb` key, e.g. `booking.cancel`. Filtered by prefix. */
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  restaurantId: number | null;
  summary: string | null;
  changes: AuditChangeDto[];
  httpMethod: string;
  path: string;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuditPage {
  items: AdminAuditEntryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditQueryParams {
  actorUserId?: number;
  /** Matched as a prefix against the dotted action key: `booking` selects every `booking.*`. */
  action?: string;
  targetType?: string;
  restaurantId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function getAuditEntries(params: AuditQueryParams): Promise<AuditPage | null> {
  try {
    const p = new URLSearchParams();
    if (params.actorUserId != null) p.set("actorUserId", String(params.actorUserId));
    if (params.action) p.set("action", params.action);
    if (params.targetType) p.set("targetType", params.targetType);
    if (params.restaurantId != null) p.set("restaurantId", String(params.restaurantId));
    if (params.from) p.set("from", params.from);
    if (params.to) p.set("to", params.to);
    if (params.page != null) p.set("page", String(params.page));
    if (params.pageSize != null) p.set("pageSize", String(params.pageSize));
    const query = p.toString() ? `?${p}` : "";
    const res = await get(`/admin/audit${query}`);
    if (!res.ok) throw new Error("Failed to fetch audit entries");
    return await res.json();
  } catch (err) {
    console.error("getAuditEntries error:", err);
    return null;
  }
}
