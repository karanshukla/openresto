import type { AdminAuditEntryDto } from "@/api/audit";
import type { IconName } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { fmtTimestamp } from "@/utils/formatters";

/**
 * What the API sends in place of a protected field's value (credentials, customer identity).
 * It is rendered as-is — there is nothing to unmask, and hiding the row would hide the fact
 * that the field changed at all, which is the part worth auditing.
 *
 * @see [audit.test.ts](../tests/utils/audit.test.ts) — pins that a masked value is reported
 * as redacted while an ordinary one is not.
 */
export const REDACTED_MARKER = "[redacted]";

export const PAGE_SIZE = 25;

/**
 * The activity-type filter's options. Each `value` is a prefix the API matches against the
 * dotted action key, so one option covers every verb in its group; `""` drops the filter
 * entirely, which is already a value a `Select` can hold and so needs no sentinel.
 */
export const ACTION_GROUPS: readonly { label: string; value: string }[] = [
  { label: "All activity", value: "" },
  { label: "Bookings", value: "booking" },
  { label: "Locations", value: "restaurant" },
  { label: "Accounts", value: "user" },
  { label: "Sign-ins", value: "auth" },
  { label: "Brand", value: "brand" },
  { label: "Email", value: "email_settings" },
  { label: "Media", value: "media" },
];

/** Mirrors `AuditActions` on the backend. A key with no entry falls back to `humanize`. */
const ACTION_LABELS: Record<string, string> = {
  "booking.create": "Created booking",
  "booking.update": "Updated booking",
  "booking.cancel": "Cancelled booking",
  "booking.restore": "Restored booking",
  "booking.extend": "Extended booking",
  "booking.purge": "Purged booking",
  "booking.email": "Re-sent booking email",

  "restaurant.create": "Created location",
  "restaurant.update": "Updated location",
  "restaurant.archive": "Archived location",
  "restaurant.restore": "Restored location",
  "restaurant.delete": "Deleted location",
  "restaurant.pause": "Paused bookings",
  "restaurant.unpause": "Resumed bookings",
  "restaurant.extend_bookings": "Extended bookings",
  "restaurant.reorder_sections": "Reordered sections",

  "section.create": "Created section",
  "section.update": "Updated section",
  "section.delete": "Deleted section",

  "table.create": "Created table",
  "table.update": "Updated table",
  "table.delete": "Deleted table",

  "table_group.create": "Created table group",
  "table_group.update": "Updated table group",
  "table_group.delete": "Deleted table group",

  "user.create": "Created user",
  "user.role_change": "Changed user role",
  "user.activate": "Activated user",
  "user.deactivate": "Deactivated user",
  "user.password_reset": "Reset user password",

  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.logout": "Signed out",
  "auth.password_change": "Changed own password",
  "auth.email_change": "Changed own email",
  "auth.pvq_setup": "Set security question",
  "auth.password_reset": "Reset own password",

  "brand.update": "Updated brand settings",
  "email_settings.update": "Updated email settings",
  "email_settings.test": "Sent test email",

  "media.upload": "Uploaded media",
  "media.delete": "Deleted media",

  "highlight.create": "Created highlight",
  "highlight.update": "Updated highlight",
  "highlight.delete": "Deleted highlight",

  "social_link.create": "Added social link",
  "social_link.update": "Updated social link",
  "social_link.delete": "Removed social link",

  "notification.delete": "Deleted notification",
  "push.subscribe": "Enabled push notifications",
  "push.unsubscribe": "Disabled push notifications",
};

const HTTP_PREFIX = "http.";

/** `widget.frobnicate_thing` → "Widget frobnicate thing". */
function humanize(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action;
}

/**
 * The readable name of an action. An unnamed key still reads as something rather than as a
 * dotted identifier, so an endpoint audited only by the middleware floor (`http.post`) stays
 * legible the day it ships.
 *
 * @see [audit.test.ts](../tests/utils/audit.test.ts) — pins both the named and the
 * fallback shapes.
 */
export function actionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  if (action.startsWith(HTTP_PREFIX)) {
    return `${action.slice(HTTP_PREFIX.length).toUpperCase()} request`;
  }
  return humanize(action);
}

const GROUP_ICONS: Record<string, IconName> = {
  booking: "calendar-outline",
  restaurant: "storefront-outline",
  section: "grid-outline",
  table: "grid-outline",
  table_group: "grid-outline",
  user: "people-outline",
  auth: "log-in-outline",
  brand: "color-palette-outline",
  email_settings: "mail-outline",
  media: "image-outline",
  highlight: "sparkles-outline",
  social_link: "link-outline",
  notification: "notifications-outline",
  push: "notifications-outline",
};

/** Exact keys whose meaning differs from the rest of their group. */
const ACTION_ICONS: Record<string, IconName> = {
  "auth.login_failed": "alert-circle-outline",
};

const FALLBACK_ICON: IconName = "ellipsis-horizontal-outline";

export function actionGroup(action: string): string {
  return action.split(".")[0];
}

export function actionIcon(action: string): IconName {
  return ACTION_ICONS[action] ?? GROUP_ICONS[actionGroup(action)] ?? FALLBACK_ICON;
}

export type StatusTone = "success" | "warning" | "danger";

/**
 * How a response code should read at a glance: a refusal (4xx) is the reviewer's cue that
 * someone tried something they could not do, and a 5xx is the instance's own failure.
 *
 * @see [audit.test.ts](../tests/utils/audit.test.ts) — pins the tone on both sides of the
 * 400 and 500 boundaries.
 */
export function statusTone(statusCode: number): StatusTone {
  if (statusCode >= 500) return "danger";
  if (statusCode >= 400) return "warning";
  return "success";
}

const TONE_COLORS: Record<StatusTone, string> = {
  success: theme.colors.success,
  warning: theme.colors.warning,
  danger: theme.colors.error,
};

export function statusColor(statusCode: number): string {
  return TONE_COLORS[statusTone(statusCode)];
}

/**
 * Who someone is, as they would want to be named: the display name they set, else the email
 * they sign in with. One rule for both shapes the admin holds a person in — an audit entry's
 * denormalized actor columns and a live `AdminUserDto` row.
 */
export function personLabel(displayName: string | null | undefined, email: string): string {
  return displayName?.trim() || email;
}

export function actorName(
  entry: Pick<AdminAuditEntryDto, "actorDisplayName" | "actorEmail">
): string {
  return personLabel(entry.actorDisplayName, entry.actorEmail);
}

/** The raw request behind an entry, as one line: `POST /api/bookings → 201`. */
export function httpLine(
  entry: Pick<AdminAuditEntryDto, "httpMethod" | "path" | "statusCode">
): string {
  return `${entry.httpMethod} ${entry.path} → ${entry.statusCode}`;
}

/** Full local timestamp for the expanded detail, where "3h ago" is no longer precise enough. */
export function formatExactTime(iso: string): string {
  return fmtTimestamp(iso);
}

/**
 * A recorded value as the diff should read it. Null is "field was unset", which is a different
 * fact from an empty string, and both are different from a value that happens to be blank.
 */
export function formatChangeValue(value: string | null): string {
  if (value === null) return "—";
  if (value.trim() === "") return "(empty)";
  return value;
}

export function isRedacted(value: string | null): boolean {
  return value === REDACTED_MARKER;
}

/**
 * A `Select` value is `string | number`, but an unset id filter is `null` — the shape the API
 * and the persisted filter state both speak. This is the value that stands in for it inside a
 * `Select`, so the location and person filters convert at that one boundary instead of each
 * carrying its own ternary.
 *
 * @see [audit.test.ts](../tests/utils/audit.test.ts) — pins that an id survives the round trip
 * and that the catch-all option comes back as `null` rather than as `NaN`.
 */
export const ANY_ID = "any";

export function toIdFilter(id: number | null): string | number {
  return id ?? ANY_ID;
}

export function fromIdFilter(value: string | number): number | null {
  return value === ANY_ID ? null : Number(value);
}
