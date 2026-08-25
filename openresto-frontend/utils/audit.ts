import type { ParseKeys, TFunction } from "i18next";
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

export interface ActionGroupOption {
  label: string;
  value: string;
}

/**
 * The activity-type filter's options. Each `value` is a prefix the API matches against the
 * dotted action key, so one option covers every verb in its group; `""` drops the filter
 * entirely, which is already a value a `Select` can hold and so needs no sentinel. `value`
 * is data compared against the wire format and never localizes — only `label` does, which is
 * why this takes `t` rather than being a plain exported constant.
 *
 * @see [audit.test.ts](../tests/utils/audit.test.ts) — pins the unfiltered option plus one
 * prefix per group, in order.
 */
export function getActionGroups(t: TFunction): ActionGroupOption[] {
  return [
    { label: t("admin.activity.actionGroups.all"), value: "" },
    { label: t("admin.activity.actionGroups.bookings"), value: "booking" },
    { label: t("admin.activity.actionGroups.locations"), value: "restaurant" },
    { label: t("admin.activity.actionGroups.accounts"), value: "user" },
    { label: t("admin.activity.actionGroups.signIns"), value: "auth" },
    { label: t("admin.activity.actionGroups.brand"), value: "brand" },
    { label: t("admin.activity.actionGroups.email"), value: "email_settings" },
    { label: t("admin.activity.actionGroups.media"), value: "media" },
  ];
}

/** Every valid translation key path, as `types/i18next.d.ts` derives it from `en.json`. Typing
 * the lookup table's values against this, rather than `string`, is what makes a typo'd
 * action-label key a `tsc` failure. */
type TranslationKey = ParseKeys;

/**
 * Mirrors `AuditActions` on the backend. The key side is the dotted action key the API and
 * database use — data, and never translated. The value side is an i18next key path rather
 * than the label text itself, so `actionLabel` can resolve it against whatever locale is
 * active. A key with no entry falls back to `humanize`.
 */
const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  "booking.create": "admin.activity.actions.bookingCreate",
  "booking.update": "admin.activity.actions.bookingUpdate",
  "booking.cancel": "admin.activity.actions.bookingCancel",
  "booking.restore": "admin.activity.actions.bookingRestore",
  "booking.extend": "admin.activity.actions.bookingExtend",
  "booking.purge": "admin.activity.actions.bookingPurge",
  "booking.email": "admin.activity.actions.bookingEmail",

  "restaurant.create": "admin.activity.actions.restaurantCreate",
  "restaurant.update": "admin.activity.actions.restaurantUpdate",
  "restaurant.archive": "admin.activity.actions.restaurantArchive",
  "restaurant.restore": "admin.activity.actions.restaurantRestore",
  "restaurant.delete": "admin.activity.actions.restaurantDelete",
  "restaurant.pause": "admin.activity.actions.restaurantPause",
  "restaurant.unpause": "admin.activity.actions.restaurantUnpause",
  "restaurant.extend_bookings": "admin.activity.actions.restaurantExtendBookings",
  "restaurant.reorder_sections": "admin.activity.actions.restaurantReorderSections",

  "section.create": "admin.activity.actions.sectionCreate",
  "section.update": "admin.activity.actions.sectionUpdate",
  "section.delete": "admin.activity.actions.sectionDelete",

  "table.create": "admin.activity.actions.tableCreate",
  "table.update": "admin.activity.actions.tableUpdate",
  "table.delete": "admin.activity.actions.tableDelete",

  "table_group.create": "admin.activity.actions.tableGroupCreate",
  "table_group.update": "admin.activity.actions.tableGroupUpdate",
  "table_group.delete": "admin.activity.actions.tableGroupDelete",

  "user.create": "admin.activity.actions.userCreate",
  "user.role_change": "admin.activity.actions.userRoleChange",
  "user.activate": "admin.activity.actions.userActivate",
  "user.deactivate": "admin.activity.actions.userDeactivate",
  "user.password_reset": "admin.activity.actions.userPasswordReset",

  "auth.login": "admin.activity.actions.authLogin",
  "auth.login_failed": "admin.activity.actions.authLoginFailed",
  "auth.logout": "admin.activity.actions.authLogout",
  "auth.password_change": "admin.activity.actions.authPasswordChange",
  "auth.email_change": "admin.activity.actions.authEmailChange",
  "auth.pvq_setup": "admin.activity.actions.authPvqSetup",
  "auth.password_reset": "admin.activity.actions.authPasswordReset",

  "brand.update": "admin.activity.actions.brandUpdate",
  "email_settings.update": "admin.activity.actions.emailSettingsUpdate",
  "email_settings.test": "admin.activity.actions.emailSettingsTest",

  "media.upload": "admin.activity.actions.mediaUpload",
  "media.delete": "admin.activity.actions.mediaDelete",

  "highlight.create": "admin.activity.actions.highlightCreate",
  "highlight.update": "admin.activity.actions.highlightUpdate",
  "highlight.delete": "admin.activity.actions.highlightDelete",

  "social_link.create": "admin.activity.actions.socialLinkCreate",
  "social_link.update": "admin.activity.actions.socialLinkUpdate",
  "social_link.delete": "admin.activity.actions.socialLinkDelete",

  "notification.delete": "admin.activity.actions.notificationDelete",
  "push.subscribe": "admin.activity.actions.pushSubscribe",
  "push.unsubscribe": "admin.activity.actions.pushUnsubscribe",
};

const HTTP_PREFIX = "http.";

/** `widget.frobnicate_thing` → "Widget frobnicate thing". Untranslatable by construction — there
 * is no key to look up for an action nobody has named yet, so this reads the dotted identifier
 * itself rather than a locale resource. */
function humanize(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : action;
}

/**
 * The readable name of an action. An unnamed key still reads as something rather than as a
 * dotted identifier, so an endpoint audited only by the middleware floor (`http.post`) stays
 * legible the day it ships. `action` is the wire value and never localizes; only the label
 * resolved from it does.
 *
 * @see [audit.test.ts](../tests/utils/audit.test.ts) — pins both the named and the
 * fallback shapes.
 */
export function actionLabel(action: string, t: TFunction): string {
  const key = ACTION_LABEL_KEYS[action];
  if (key) return t(key);
  if (action.startsWith(HTTP_PREFIX)) {
    return t("admin.activity.detail.httpRequestLabel", {
      method: action.slice(HTTP_PREFIX.length).toUpperCase(),
    });
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

/** The raw request behind an entry, as one line: `POST /api/bookings → 201`. Built entirely
 * from wire values, so it stays untranslated. */
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
 * `—` is a symbol rather than English and stays literal; "(empty)" is user-facing copy and
 * localizes through `t`. A non-blank value is the field's own stored data and passes through
 * untranslated.
 */
export function formatChangeValue(value: string | null, t: TFunction): string {
  if (value === null) return "—";
  if (value.trim() === "") return t("admin.activity.detail.emptyValue");
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
