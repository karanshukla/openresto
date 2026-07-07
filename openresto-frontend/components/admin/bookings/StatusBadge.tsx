import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { styles } from "./bookings.styles";

export type BadgeVariant = "arrived" | "seated" | "upcoming" | "scheduled" | "completed";

/**
 * Whether a booking's date/time has already passed, using the same 5-minute
 * clock-skew grace window as the backend's create/cancel guards
 * (BookingService.cs and AdminService.cs both enforce this independently —
 * keep all three in sync if the window ever changes). Distinct from the
 * 90-minute "Completed" cosmetic bucket in getStatus below, which serves a
 * different purpose (list bucketing, not action-gating).
 */
export function isPast(date: string): boolean {
  return new Date(date).getTime() < Date.now() - 5 * 60 * 1000;
}

export function getStatus(date: string): { label: string; variant: BadgeVariant } {
  const d = new Date(date);
  const now = new Date();
  const diffMins = (d.getTime() - now.getTime()) / 60000;
  if (diffMins < -90) return { label: "Completed", variant: "completed" };
  if (diffMins < -15) return { label: "Seated", variant: "seated" };
  if (diffMins < 5) return { label: "Arrived", variant: "arrived" };
  if (diffMins < 60) return { label: "Upcoming", variant: "upcoming" };
  return { label: "Scheduled", variant: "scheduled" };
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
  const { label, variant } = getStatus(date);
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
