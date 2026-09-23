import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { WaitlistEntryStatus } from "@/api/waitlist";
import type { WaitlistEntryState } from "./useWaitlistEntry";
import WaitEstimate from "./WaitEstimate";
import { styles } from "./WaitlistTicket.styles";

/** The guest's ticket: where they stand, and a way out while they are still queued. */
export default function WaitlistTicket({ state }: { state: WaitlistEntryState }) {
  const { t } = useTranslation();
  const { colors, primaryColor } = useAppTheme();
  const { entry, queued, refreshFailed, leaving, leaveFailed, leave } = state;

  if (entry === undefined) {
    return refreshFailed ? (
      <ThemedText style={[styles.muted, { color: colors.error }]}>
        {t("booking.waitlist.loadFailed")}
      </ThemedText>
    ) : (
      <ActivityIndicator testID="waitlist-status-loading" />
    );
  }

  return (
    <View style={styles.root}>
      {entry === null ? (
        <ThemedText testID="waitlist-not-found" style={styles.line}>
          {t("booking.waitlistStatus.notFound")}
        </ThemedText>
      ) : (
        <StatusCard entry={entry} highlight={primaryColor} />
      )}
      {refreshFailed && (
        <ThemedText style={[styles.muted, { color: colors.error }]}>
          {t("booking.waitlistStatus.loadFailed")}
        </ThemedText>
      )}
      {queued && (
        <>
          <ThemedText style={[styles.muted, { color: colors.muted }]}>
            {t("booking.waitlistStatus.keepOpen")}
          </ThemedText>
          {leaveFailed && (
            <ThemedText style={[styles.muted, { color: colors.error }]}>
              {t("booking.waitlistStatus.leaveFailed")}
            </ThemedText>
          )}
          <Button
            variant="secondary"
            tone="danger"
            loading={leaving}
            onPress={leave}
            testID="waitlist-leave"
          >
            {t("booking.waitlistStatus.leave")}
          </Button>
        </>
      )}
    </View>
  );
}

function StatusCard({ entry, highlight }: { entry: WaitlistEntryStatus; highlight: string }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const ready = entry.status === "notified";

  return (
    <View
      testID={`waitlist-status-${entry.status}`}
      style={[
        styles.card,
        {
          borderColor: ready ? highlight : colors.border,
          backgroundColor: colors.card,
        },
      ]}
    >
      <ThemedText style={[styles.ticket, { color: colors.muted }]}>
        {t("booking.waitlistStatus.ticket", { number: entry.number })}
        {" · "}
        {t("booking.waitlistStatus.partySize", { count: entry.seats })}
      </ThemedText>
      <ThemedText style={styles.title}>{t(TITLES[entry.status])}</ThemedText>
      {ready && (
        <ThemedText style={styles.line}>{t("booking.waitlistStatus.readyBody")}</ThemedText>
      )}
      {entry.status === "waiting" && (
        <>
          <ThemedText style={styles.line}>
            {entry.partiesAhead
              ? t("booking.waitlistStatus.partiesAhead", { count: entry.partiesAhead })
              : t("booking.waitlistStatus.next")}
          </ThemedText>
          <ThemedText style={[styles.line, { color: colors.muted }]}>
            <WaitEstimate minutes={entry.estimatedWaitMinutes} />
          </ThemedText>
        </>
      )}
    </View>
  );
}

const TITLES = {
  waiting: "booking.waitlistStatus.waitingTitle",
  notified: "booking.waitlistStatus.readyTitle",
  seated: "booking.waitlistStatus.seatedTitle",
  left: "booking.waitlistStatus.leftTitle",
  expired: "booking.waitlistStatus.expiredTitle",
} as const;
