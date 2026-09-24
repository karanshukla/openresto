import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import RowTextButton from "@/components/common/RowTextButton";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { relativeTime } from "@/utils/formatters";
import type { WaitlistEntry } from "@/api/waitlist";
import { styles } from "@/styles/admin/waitlist.styles";

type WaitlistAction = "notify" | "seat" | "remove";

/**
 * One party on the host stand's board. Seat is offered only when a table can take the party
 * this minute, so the button is never a guess that comes back as a 409.
 *
 * @see [WaitlistRow.test.tsx](../../../tests/components/admin/waitlist/WaitlistRow.test.tsx) —
 * pins Seat following `canSeatNow`, the call-again label, and the hidden-guest fallback.
 */
export default function WaitlistRow({
  entry,
  busy,
  isLast,
  onAction,
}: {
  entry: WaitlistEntry;
  busy: boolean;
  isLast: boolean;
  onAction: (action: WaitlistAction) => void;
}) {
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  const called = entry.status === "notified";
  const who = waitlistPartyName(entry, t);
  // The success green is 3.3:1 on a light card; the arrived badge's green clears 4.5:1.
  const seatColor = isDark ? colors.success : theme.status.arrived.text;

  const wait =
    entry.estimatedWaitMinutes === null
      ? t("admin.waitlist.waitUnknown")
      : entry.estimatedWaitMinutes === 0
        ? t("admin.waitlist.waitNow")
        : t("admin.waitlist.waitMinutes", { minutes: entry.estimatedWaitMinutes });

  return (
    <View
      testID={`waitlist-row-${entry.id}`}
      style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
    >
      <ThemedText style={[styles.ticket, { color: called ? primaryColor : colors.text }]}>
        #{entry.number}
      </ThemedText>
      <View style={styles.who}>
        <ThemedText style={styles.name}>{entry.name ?? t("admin.waitlist.hiddenGuest")}</ThemedText>
        <ThemedText style={[styles.meta, { color: colors.muted }]}>
          {t("admin.waitlist.guests", { count: entry.seats })}
          {" · "}
          {called && entry.notifiedAt
            ? t("admin.waitlist.called", { time: relativeTime(entry.notifiedAt) })
            : t("admin.waitlist.joined", { time: relativeTime(entry.joinedAt) })}
          {entry.email ? ` · ${entry.email}` : ""}
        </ThemedText>
      </View>
      <ThemedText style={[styles.wait, { color: entry.canSeatNow ? seatColor : colors.muted }]}>
        {wait}
      </ThemedText>
      <View style={styles.actions}>
        <RowTextButton
          label={t("admin.waitlist.remove")}
          accessibilityLabel={t("admin.waitlist.removeLabel", { name: who })}
          color={colors.error}
          icon="trash-outline"
          disabled={busy}
          onPress={() => onAction("remove")}
          testID={`waitlist-remove-${entry.id}`}
        />
        <RowTextButton
          label={called ? t("admin.waitlist.callAgain") : t("admin.waitlist.call")}
          accessibilityLabel={
            called
              ? t("admin.waitlist.callAgainLabel", { name: who })
              : t("admin.waitlist.callLabel", { name: who })
          }
          color={primaryColor}
          icon="megaphone-outline"
          disabled={busy}
          onPress={() => onAction("notify")}
          testID={`waitlist-call-${entry.id}`}
        />
        <RowTextButton
          label={t("admin.waitlist.seat")}
          accessibilityLabel={t("admin.waitlist.seatLabel", { name: who })}
          color={seatColor}
          icon="checkmark"
          disabled={busy || !entry.canSeatNow}
          onPress={() => onAction("seat")}
          testID={`waitlist-seat-${entry.id}`}
        />
      </View>
    </View>
  );
}

/** The party's name, or its ticket number where the key may not read guest details. */
export function waitlistPartyName(entry: WaitlistEntry, t: TFunction): string {
  return entry.name ?? t("admin.waitlist.ticketName", { number: entry.number });
}
