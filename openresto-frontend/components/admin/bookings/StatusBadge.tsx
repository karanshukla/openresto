import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { styles } from "./bookings.styles";
import { BookingDetailDto } from "@/api/admin";
import { isPast } from "@/utils/bookingStatus";

export type BadgeVariant = "arrived" | "seated" | "upcoming" | "scheduled" | "completed";

// Re-exported for the admin modules that already import isPast from here.
// isPast itself lives in utils/bookingStatus so the customer-facing lookup
// and booking-confirmation screens don't have to reach into components/admin.
export { isPast };

/**
 * `variant` is the sorting/styling key (STATUS_RANK, BADGE_STYLES below) and is never
 * rendered on its own — `getStatus` below resolves it to a localized `label` through `t`.
 * Keeping `variant` untranslated is what lets `statusRankFor` sort correctly regardless
 * of UI language.
 * @see [StatusBadge.test.tsx](../../../tests/components/StatusBadge.test.tsx)
 * — pins that the label localizes while the variant/rank stay locale-independent.
 */
export function statusVariantFor(date: string): BadgeVariant {
  const d = new Date(date);
  const now = new Date();
  const diffMins = (d.getTime() - now.getTime()) / 60000;
  if (diffMins < -90) return "completed";
  if (diffMins < -15) return "seated";
  if (diffMins < 5) return "arrived";
  if (diffMins < 60) return "upcoming";
  return "scheduled";
}

export function getStatus(date: string, t: TFunction): { label: string; variant: BadgeVariant } {
  const variant = statusVariantFor(date);
  switch (variant) {
    case "arrived":
      return { label: t("admin.bookings.status.arrived"), variant };
    case "seated":
      return { label: t("admin.bookings.status.seated"), variant };
    case "upcoming":
      return { label: t("admin.bookings.status.upcoming"), variant };
    case "scheduled":
      return { label: t("admin.bookings.status.scheduled"), variant };
    case "completed":
      return { label: t("admin.bookings.status.completed"), variant };
  }
}

// Lifecycle rank for status-based sorting (issue #208). Higher rank surfaces
// earlier in the default (ascending) sort, so the most attention-worthy rows
// land at the top: in-progress first, then upcoming/future, then historical,
// with cancelled last. Reuses statusVariantFor so the time thresholds stay
// defined in exactly one place (see the keep-in-sync note on isPast above).
const STATUS_RANK: Record<BadgeVariant, number> = {
  arrived: 5, // in-progress: sitting down now
  seated: 4, // in-progress: recently seated
  upcoming: 3, // imminent (next hour)
  scheduled: 2, // future
  completed: 1, // historical
};

/** Numeric status rank for sorting; cancelled bookings sort last (rank 0). */
export function statusRankFor(b: BookingDetailDto): number {
  if (b.isCancelled) return 0;
  return STATUS_RANK[statusVariantFor(b.date)];
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
  upcoming: theme.status.upcoming as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  scheduled: theme.status.scheduled as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
  completed: theme.status.completed as {
    bg: { light: string; dark: string };
    text: string | { light: string; dark: string };
  },
};

export function StatusBadge({ date, isDark }: { date: string; isDark: boolean }) {
  const { t } = useTranslation();
  const { label, variant } = getStatus(date, t);
  const s = BADGE_STYLES[variant];

  const bg = isDark && s.bg.dark ? s.bg.dark : s.bg.light;
  let text = typeof s.text === "string" ? s.text : isDark ? s.text.dark : s.text.light;

  // Fallbacks based on original implementation for contrast in dark mode
  if (isDark) {
    if (variant === "arrived") text = "#4ade80";
    if (variant === "upcoming") text = "#fde047";
    if (variant === "scheduled") text = "#94a3b8";
    if (variant === "completed") text = "#64748b";
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.badgeText, { color: text as string }]}>{label}</ThemedText>
    </View>
  );
}
