import { get, post } from "./client";
import { apiErrorMessage } from "@/api/errors";

/**
 * The resources an admin API key can be scoped to. See {@link READ_ONLY_SCOPE_RESOURCES} for
 * the subset with no write surface at all.
 */
export const SCOPE_RESOURCES = [
  "bookings",
  "locations",
  "tables",
  "brand",
  "users",
  "audit",
  "guests",
  "email",
] as const;

export type ScopeResource = (typeof SCOPE_RESOURCES)[number];

export const SCOPE_ACCESS_LEVELS = ["read", "write"] as const;

export type ScopeAccess = (typeof SCOPE_ACCESS_LEVELS)[number];

/**
 * Resources with no write surface at all: the audit trail is append-only with no admin write
 * endpoint (see CLAUDE.md's audit-trail section), guest visibility is a read-time redaction
 * toggle rather than a mutable resource, and email is deliberately read-only — a key that could
 * rewrite the SMTP host and credentials would redirect every outgoing mail to a relay it
 * controls. Mirrors the backend's `ApiKeyScopes.ReadOnlyResources` — minting any of them as
 * `write` is rejected server-side, so the picker never offers it.
 */
export const READ_ONLY_SCOPE_RESOURCES: ReadonlySet<ScopeResource> = new Set([
  "audit",
  "guests",
  "email",
]);

export interface ApiKeyScope {
  resource: ScopeResource;
  access: ScopeAccess;
}

/** An admin API key as listed by the Owner-only key management API. The secret itself is
 * never part of this shape — it exists only in the one response that mints it. */
export interface ApiKeyDto {
  id: number;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
  neverExpires?: boolean;
}

/** The one response that ever carries the full secret — shown once, then gone. */
export interface CreatedApiKey extends ApiKeyDto {
  secret: string;
}

export type ApiKeyMutationResult = { ok: true; key: ApiKeyDto } | { ok: false; message: string };

export type CreateApiKeyResult = { ok: true; key: CreatedApiKey } | { ok: false; message: string };

/**
 * The revoke endpoint's success shape isn't fully pinned down (a row, or a bare 204), so this
 * is deliberately looser than {@link ApiKeyMutationResult}: `key` is the updated row when the
 * server sends one, and `null` when it answered with no body — the caller falls back to
 * marking the row revoked locally rather than treating an empty success as a failure.
 */
export type RevokeApiKeyResult =
  { ok: true; key: ApiKeyDto | null } | { ok: false; message: string };

async function errorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return apiErrorMessage(body, "Request failed.");
}

export async function adminListApiKeys(): Promise<ApiKeyDto[] | null> {
  try {
    const res = await get("/admin/api-keys");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function adminCreateApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
  try {
    const res = await post("/admin/api-keys", input);
    if (!res.ok) return { ok: false, message: await errorMessage(res) };
    return { ok: true, key: (await res.json()) as CreatedApiKey };
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export async function adminRevokeApiKey(id: number): Promise<RevokeApiKeyResult> {
  try {
    const res = await post(`/admin/api-keys/${id}/revoke`);
    if (!res.ok) return { ok: false, message: await errorMessage(res) };
    if (res.status === 204) return { ok: true, key: null };
    const body = await res.json().catch(() => null);
    return { ok: true, key: body as ApiKeyDto | null };
  } catch {
    return { ok: false, message: "Network error." };
  }
}
