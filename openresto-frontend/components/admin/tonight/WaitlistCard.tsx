import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import RowTextButton from "@/components/common/RowTextButton";
import { Icon } from "@/components/common/Icon";
import { waitlistPartyName } from "@/components/admin/waitlist/WaitlistRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { relativeTime } from "@/utils/formatters";
import type { WaitlistEntry } from "@/api/waitlist";
import { styles } from "./WaitlistCard.styles";

/**
 * One waiting party on the host view, read the way a host looks for them: party size first, then
 * who and for how long. Its one seating button always says where the party will land — "Seat at
 * D2" when a single table can take them, otherwise "Choose table", which lists the tables under
 * the party (`tray`) instead of sending the host across the floor.
 *
 * @see [WaitlistCard.test.tsx](../../../tests/components/admin/tonight/WaitlistCard.test.tsx) —
 * pins the seating button naming a lone table, opening the list for several, falling back to
 * the server's pick, and held back while nothing fits.
 */
export function WaitlistCard({
  entry,
  busy,
  isLast,
  choosing,
  tableCount,
  onlyTable,
  tray,
  onSeat,
  onChooseTable,
  onCall,
  onRemove,
}: {
  entry: WaitlistEntry;
  busy: boolean;
  isLast: boolean;
  /** This party's table list is open. */
  choosing: boolean;
  /** How many tiles can take the party for a whole sitting right now. */
  tableCount: number;
  /** That tile's label when there is exactly one. */
  onlyTable?: string;
  /** The table list, rendered while `choosing`. */
  tray?: ReactNode;
  /** Seats the party at the lone table, or wherever the server picks when no tile is known. */
  onSeat: () => void;
  onChooseTable: () => void;
  onCall: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  const called = entry.status === "notified";
  const who = waitlistPartyName(entry, t);
  const free = theme.floor.free;
  const freeText = isDark ? free.text.dark : free.text.light;
  const freeBg = isDark ? free.bg.dark : free.bg.light;

  const wait =
    entry.skipsNumber !== null
      ? t("admin.waitlist.waitSkips", { number: entry.skipsNumber })
      : entry.estimatedWaitMinutes === null
        ? t("admin.waitlist.waitUnknown")
        : entry.estimatedWaitMinutes === 0
          ? t("admin.waitlist.waitNow")
          : t("admin.waitlist.waitMinutes", { minutes: entry.estimatedWaitMinutes });

  return (
    <View
      testID={`waitlist-card-${entry.id}`}
      style={[
        styles.card,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
        choosing && { borderLeftColor: primaryColor, backgroundColor: colors.surfaceAlt },
      ]}
    >
      <View style={styles.top}>
        <View
          style={[
            styles.party,
            { backgroundColor: entry.canSeatNow ? freeBg : colors.surfaceAlt },
            choosing && { backgroundColor: colors.card },
          ]}
          accessibilityLabel={t("admin.waitlist.guests", { count: entry.seats })}
        >
          <ThemedText
            style={[styles.partySize, { color: entry.canSeatNow ? freeText : colors.text }]}
          >
            {entry.seats}
          </ThemedText>
          <Icon name="people" size="xs" color={entry.canSeatNow ? freeText : colors.muted} />
        </View>
        <View style={styles.main}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {entry.name ?? t("admin.waitlist.hiddenGuest")}
            </ThemedText>
            <ThemedText style={[styles.ticket, { color: called ? primaryColor : colors.muted }]}>
              #{entry.number}
            </ThemedText>
          </View>
          <ThemedText style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
            {called && entry.notifiedAt
              ? t("admin.waitlist.called", { time: relativeTime(entry.notifiedAt) })
              : t("admin.waitlist.joined", { time: relativeTime(entry.joinedAt) })}
          </ThemedText>
          <ThemedText
            style={[styles.wait, { color: entry.canSeatNow ? freeText : colors.muted }]}
            testID={`waitlist-wait-${entry.id}`}
          >
            {wait}
          </ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <RowTextButton
          label={t("admin.waitlist.remove")}
          accessibilityLabel={t("admin.waitlist.removeLabel", { name: who })}
          color={colors.error}
          icon="trash-outline"
          disabled={busy}
          onPress={onRemove}
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
          onPress={onCall}
          testID={`waitlist-call-${entry.id}`}
        />
        {tableCount > 1 ? (
          <Button
            size="sm"
            variant="secondary"
            tone={choosing ? "neutral" : "brand"}
            icon={choosing ? undefined : "chevron-down"}
            iconPosition="trailing"
            disabled={busy}
            onPress={onChooseTable}
            accessibilityLabel={
              choosing
                ? t("admin.tonight.pick.cancel")
                : t("admin.tonight.arrivals.chooseTableLabel", { name: who })
            }
            style={styles.seat}
            testID={`waitlist-choose-${entry.id}`}
          >
            {choosing ? t("admin.tonight.pick.cancel") : t("admin.tonight.arrivals.chooseTable")}
          </Button>
        ) : (
          <Button
            size="sm"
            icon="checkmark"
            disabled={busy || !entry.canSeatNow}
            onPress={onSeat}
            accessibilityLabel={
              onlyTable
                ? t("admin.tonight.tile.seatLabel", { name: who, table: onlyTable })
                : t("admin.waitlist.seatLabel", { name: who })
            }
            style={styles.seat}
            testID={`waitlist-seat-${entry.id}`}
          >
            {onlyTable && entry.canSeatNow
              ? t("admin.tonight.seatAt.direct", { table: onlyTable })
              : t("admin.waitlist.seat")}
          </Button>
        )}
      </View>

      {choosing && tray}
    </View>
  );
}
