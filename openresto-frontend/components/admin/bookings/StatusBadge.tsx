import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { styles } from "./bookings.styles";
import { BookingDetailDto, type BookingStatus } from "@/api/admin";
import { isPast } from "@/utils/bookingStatus";

export type BadgeVariant =
  "arrived" | "seated" | "due" | "upcoming" | "scheduled" | "unmarked" | "finished" | "noShow";

/** The fields a badge reads. `endTime` is the booking's own end, which turn times make vary. */
export interface BadgeBooking {
  date: string;
  endTime?: string;
  status?: BookingStatus;
}

/** Sitting length assumed when a booking carries no end, matching `BookingDuration.FallbackMinutes`. */
const FALLBACK_SITTING_MINUTES = 60;

// Re-exported for the admin modules that already import isPast from here.
// isPast itself lives in utils/bookingStatus so the customer-facing lookup
// and booking-confirmation screens don't have to reach into components/admin.
export { isPast };

/**
 * `variant` is the sorting/styling key (STATUS_RANK, BADGE_STYLES below) and is never
 * rendered on its own — `getStatus` below resolves it to a localized `label` through `t`.
 * Keeping `variant` untranslated is what lets `statusRankFor` sort correctly regardless
 * of UI language.
 *
 * Arrived, Seated, Finished and No-show only ever come from a status staff recorded. A booking
 * still `Booked` says only what the clock knows: Due while its sitting is under way and nobody
 * has checked the party in, Unmarked once its own end has passed.
 * @see [StatusBadge.test.tsx](../../../tests/components/StatusBadge.test.tsx)
 * — pins that the label localizes while the variant/rank stay locale-independent, that a
 * recorded status overrides the clock, and that Due runs to the booking's own end.
 */
export function statusVariantFor({ date, endTime, status }: BadgeBooking): BadgeVariant {
  switch (status) {
    case "Arrived":
      return "arrived";
    case "Seated":
      return "seated";
    case "Finished":
      return "finished";
    case "NoShow":
      return "noShow";
  }
  const now = Date.now();
  const start = new Date(date).getTime();
  const end = endTime ? new Date(endTime).getTime() : start + FALLBACK_SITTING_MINUTES * 60 * 1000;
  if (now >= end) return "unmarked";
  if (now >= start) return "due";
  if (start - now < 60 * 60 * 1000) return "upcoming";
  return "scheduled";
}

export function getStatus(
  booking: BadgeBooking,
  t: TFunction
): { label: string; variant: BadgeVariant } {
  const variant = statusVariantFor(booking);
  switch (variant) {
    case "arrived":
      return { label: t("admin.bookings.status.arrived"), variant };
    case "seated":
      return { label: t("admin.bookings.status.seated"), variant };
    case "due":
      return { label: t("admin.bookings.status.due"), variant };
    case "upcoming":
      return { label: t("admin.bookings.status.upcoming"), variant };
    case "scheduled":
      return { label: t("admin.bookings.status.scheduled"), variant };
    case "unmarked":
      return { label: t("admin.bookings.status.unmarked"), variant };
    case "finished":
      return { label: t("admin.bookings.status.finished"), variant };
    case "noShow":
      return { label: t("admin.bookings.status.noShow"), variant };
  }
}

// Lifecycle rank for status-based sorting (issue #208). Higher rank surfaces
// earlier in the default (ascending) sort, so the most attention-worthy rows
// land at the top: a party that should be here and isn't checked in, then the
// floor, then upcoming/future, then historical, with cancelled last. Reuses
// statusVariantFor so the time thresholds stay defined in exactly one place.
const STATUS_RANK: Record<BadgeVariant, number> = {
  due: 6,
  arrived: 5,
  seated: 4,
  upcoming: 3,
  scheduled: 2,
  unmarked: 1,
  finished: 1,
  noShow: 1,
};

/** Numeric status rank for sorting; cancelled bookings sort last (rank 0). */
export function statusRankFor(b: BookingDetailDto): number {
  if (b.isCancelled) return 0;
  return STATUS_RANK[statusVariantFor(b)];
}

const BADGE_STYLES: Record<
  BadgeVariant,
  { bg: { light: string; dark: string }; text: string | { light: string; dark: string } }
> = {
  arrived: theme.status.arrived as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  seated: theme.status.seated as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  due: theme.status.upcoming as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  upcoming: theme.status.upcoming as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  scheduled: theme.status.scheduled as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  unmarked: theme.status.completed as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  finished: theme.status.completed as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  // The cancelled red reads at 4.1:1 on its own tint (3:1 in dark), so the badge text steps
  // a shade darker, or lighter on the dark tint, to clear 4.5:1.
  noShow: { bg: theme.status.cancelled.bg, text: { light: "#b91c1c", dark: "#f87171" } },
};

export function StatusBadge({ booking, isDark }: { booking: BadgeBooking; isDark: boolean }) {
  const { t } = useTranslation();
  const { label, variant } = getStatus(booking, t);
  const s = BADGE_STYLES[variant];

  const bg = isDark && s.bg.dark ? s.bg.dark : s.bg.light;
  let text = typeof s.text === "string" ? s.text : isDark ? s.text.dark : s.text.light;

  // Fallbacks based on original implementation for contrast in dark mode
  if (isDark) {
    if (variant === "arrived") text = "#4ade80";
    if (variant === "upcoming" || variant === "due") text = "#fde047";
    if (variant === "scheduled") text = "#94a3b8";
    if (variant === "unmarked" || variant === "finished") text = "#7c8ba1";
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.badgeText, { color: text as string }]}>{label}</ThemedText>
    </View>
  );
}
