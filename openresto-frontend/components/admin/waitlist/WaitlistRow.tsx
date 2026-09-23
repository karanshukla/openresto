import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import RowTextButton from "@/components/common/RowTextButton";
import { useAppTheme } from "@/hooks/use-app-theme";
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
  onAction,
}: {
  entry: WaitlistEntry;
  busy: boolean;
  onAction: (action: WaitlistAction) => void;
}) {
  const { t } = useTranslation();
  const { colors, primaryColor } = useAppTheme();
  const called = entry.status === "notified";

  const wait =
    entry.estimatedWaitMinutes === null
      ? t("admin.waitlist.waitUnknown")
      : entry.estimatedWaitMinutes === 0
        ? t("admin.waitlist.waitNow")
        : t("admin.waitlist.waitMinutes", { minutes: entry.estimatedWaitMinutes });

  return (
    <View
      testID={`waitlist-row-${entry.id}`}
      style={[styles.row, { borderBottomColor: colors.border }]}
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
      <ThemedText
        style={[styles.wait, { color: entry.canSeatNow ? colors.success : colors.muted }]}
      >
        {wait}
      </ThemedText>
      <View style={styles.actions}>
        <RowTextButton
          label={t("admin.waitlist.remove")}
          color={colors.error}
          disabled={busy}
          onPress={() => onAction("remove")}
          testID={`waitlist-remove-${entry.id}`}
        />
        <RowTextButton
          label={called ? t("admin.waitlist.callAgain") : t("admin.waitlist.call")}
          color={primaryColor}
          icon="megaphone-outline"
          disabled={busy}
          onPress={() => onAction("notify")}
          testID={`waitlist-call-${entry.id}`}
        />
        <RowTextButton
          label={t("admin.waitlist.seat")}
          color={colors.success}
          icon="checkmark"
          disabled={busy || !entry.canSeatNow}
          onPress={() => onAction("seat")}
          testID={`waitlist-seat-${entry.id}`}
        />
      </View>
    </View>
  );
}
