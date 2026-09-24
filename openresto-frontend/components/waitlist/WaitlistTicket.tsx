import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ConfirmModal from "@/components/common/ConfirmModal";
import type { IconName } from "@/components/common/Icon";
import { SummaryHeader } from "@/components/booking/BookingSummaryHeader";
import { FactsBand, type Fact } from "@/components/booking/BookingFactsBand";
import { styles as cardStyles } from "@/components/booking/BookingResultPanel.styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fmtTime } from "@/utils/formatters";
import type { WaitlistEntryStatus } from "@/api/waitlist";
import type { WaitlistEntryState } from "./useWaitlistEntry";
import { styles } from "./WaitlistTicket.styles";

/**
 * The guest's ticket, laid out as the booking card is: where they stand over the location, the
 * facts in a band, and the way out at the foot while they are still queued.
 */
export default function WaitlistTicket({ state }: { state: WaitlistEntryState }) {
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  const {
    entry,
    queued,
    refreshFailed,
    leaving,
    leaveFailed,
    leave,
    showLeaveConfirm,
    setShowLeaveConfirm,
  } = state;

  if (entry === undefined) {
    return refreshFailed ? (
      <ThemedText style={[styles.muted, { color: colors.error }]}>
        {t("booking.waitlist.loadFailed")}
      </ThemedText>
    ) : (
      <ActivityIndicator testID="waitlist-status-loading" />
    );
  }

  if (entry === null) {
    return (
      <ThemedText testID="waitlist-not-found" style={styles.line}>
        {t("booking.waitlistStatus.notFound")}
      </ThemedText>
    );
  }

  const ready = entry.status === "notified";
  const statusColor = queued ? primaryColor : colors.muted;
  // As on the booking card, the outcomes that change what the guest does next wash the header.
  const tint = ready ? `${primaryColor}${isDark ? "26" : "14"}` : queued ? null : colors.surfaceAlt;
  const divider = <View style={[cardStyles.divider, { backgroundColor: colors.border }]} />;

  return (
    <View
      testID={`waitlist-status-${entry.status}`}
      style={[cardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <SummaryHeader
        name={entry.restaurantName}
        subline={subline(entry, t)}
        statusLabel={t(STATUS_TITLES[entry.status])}
        statusIcon={STATUS_ICONS[entry.status]}
        statusColor={statusColor}
        mutedColor={colors.muted}
        tint={tint}
      />

      {divider}

      <FactsBand facts={facts(entry, t)} mutedColor={colors.muted} borderColor={colors.border} />

      {(queued || refreshFailed) && (
        <>
          {divider}
          <View style={cardStyles.cancelSection}>
            {refreshFailed && (
              <ThemedText style={[cardStyles.cancelHint, { color: colors.error }]}>
                {t("booking.waitlistStatus.loadFailed")}
              </ThemedText>
            )}
            {queued && (
              <>
                <Button
                  variant="primary"
                  tone="danger"
                  size="md"
                  icon="exit-outline"
                  loading={leaving}
                  onPress={() => setShowLeaveConfirm(true)}
                  testID="waitlist-leave"
                >
                  {t("booking.waitlistStatus.leave")}
                </Button>
                {leaveFailed && (
                  <ThemedText style={[cardStyles.cancelHint, { color: colors.error }]}>
                    {t("booking.waitlistStatus.leaveFailed")}
                  </ThemedText>
                )}
                {entry.pushEnabled && (
                  <ThemedText style={[cardStyles.cancelHint, { color: colors.muted }]}>
                    {t("booking.waitlistStatus.pushOn")}
                  </ThemedText>
                )}
              </>
            )}
          </View>
        </>
      )}

      {showLeaveConfirm && (
        <ConfirmModal
          visible={showLeaveConfirm}
          title={t("booking.waitlistStatus.leaveModal.title")}
          message={t("booking.waitlistStatus.leaveModal.message")}
          confirmLabel={
            leaving
              ? t("booking.waitlistStatus.leaveModal.confirming")
              : t("booking.waitlistStatus.leaveModal.confirm")
          }
          cancelLabel={t("booking.waitlistStatus.leaveModal.keep")}
          destructive
          onConfirm={leave}
          onCancel={() => !leaving && setShowLeaveConfirm(false)}
        />
      )}
    </View>
  );
}

function subline(entry: WaitlistEntryStatus, t: TFunction): string | undefined {
  if (entry.status === "notified") return t("booking.waitlistStatus.readyBody");
  if (entry.status !== "waiting") return undefined;
  return entry.partiesAhead
    ? t("booking.waitlistStatus.partiesAhead", { count: entry.partiesAhead })
    : t("booking.waitlistStatus.next");
}

/** Ticket and party, then the wait while it is still being waited, else when they joined. */
function facts(entry: WaitlistEntryStatus, t: TFunction): Fact[] {
  const ticket = { key: t("booking.waitlistStatus.ticketKey"), value: `#${entry.number}` };
  const party = { key: t("booking.factsBand.guestsKey"), value: String(entry.seats) };
  const minutes = entry.estimatedWaitMinutes;
  const last =
    entry.status === "waiting"
      ? {
          key: t("booking.waitlistStatus.waitKey"),
          value:
            minutes === null
              ? "—"
              : minutes === 0
                ? t("booking.waitlistStatus.waitNow")
                : t("booking.waitlistStatus.waitValue", { minutes }),
        }
      : { key: t("booking.waitlistStatus.joinedKey"), value: fmtTime(new Date(entry.joinedAt)) };
  return [ticket, party, last];
}

const STATUS_TITLES = {
  waiting: "booking.waitlistStatus.waitingTitle",
  notified: "booking.waitlistStatus.readyTitle",
  seated: "booking.waitlistStatus.seatedTitle",
  left: "booking.waitlistStatus.leftTitle",
  expired: "booking.waitlistStatus.expiredTitle",
} as const;

const STATUS_ICONS: Record<WaitlistEntryStatus["status"], IconName> = {
  waiting: "hourglass-outline",
  notified: "notifications",
  seated: "checkmark-circle",
  left: "close-circle",
  expired: "time-outline",
};
