import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import PageContainer from "@/components/layout/PageContainer";
import ScreenHeading from "@/components/layout/ScreenHeading";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { getWaitlistStatus, leaveWaitlist, type WaitlistEntryStatus } from "@/api/waitlist";
import { confirm } from "@/utils/confirm";
import haptics from "@/utils/haptics";
import WaitEstimate from "./WaitEstimate";
import { styles } from "./WaitlistStatusScreen.styles";

/** How often a queued guest's page re-reads their place. The server has no push for this. */
export const WAITLIST_POLL_MS = 20_000;

/**
 * A guest's place in the walk-in queue, read by the ref they were given on joining. It polls
 * while the entry is still queued and stops once it has left, and buzzes once when the party
 * is called, since the guest is usually not looking at the screen.
 *
 * @see [WaitlistStatusScreen.test.tsx](../../tests/components/waitlist/WaitlistStatusScreen.test.tsx)
 * — pins the polling stopping once the entry closes, the single buzz on being called, and leave.
 */
export default function WaitlistStatusScreen({ entryRef }: { entryRef: string }) {
  const { t } = useTranslation();
  const { colors, primaryColor } = useAppTheme();

  const [entry, setEntry] = useState<WaitlistEntryStatus | null | undefined>(undefined);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveFailed, setLeaveFailed] = useState(false);
  const lastStatus = useRef<string | null>(null);

  const load = useCallback(async () => {
    const next = await getWaitlistStatus(entryRef);
    if (next === undefined) {
      setRefreshFailed(true);
      return;
    }
    setRefreshFailed(false);
    if (next?.status === "notified" && lastStatus.current === "waiting") {
      haptics.outcome("success");
    }
    lastStatus.current = next?.status ?? null;
    setEntry(next);
  }, [entryRef]);

  const queued = entry?.status === "waiting" || entry?.status === "notified";

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!queued) return;
    const timer = setInterval(load, WAITLIST_POLL_MS);
    return () => clearInterval(timer);
  }, [queued, load]);

  const leave = async () => {
    if (!(await confirm(t("booking.waitlistStatus.leave")))) return;
    setLeaving(true);
    const ok = await leaveWaitlist(entryRef);
    setLeaving(false);
    setLeaveFailed(!ok);
    if (ok) await load();
  };

  if (entry === undefined) {
    return (
      <ThemedView style={styles.root}>
        {refreshFailed ? (
          <ThemedText style={[styles.muted, { color: colors.error }]}>
            {t("booking.waitlist.loadFailed")}
          </ThemedText>
        ) : (
          <ActivityIndicator testID="waitlist-status-loading" />
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PageContainer style={styles.page}>
          <ScreenHeading
            title={t("booking.waitlistStatus.routeTitle")}
            subtitle={entry?.restaurantName ?? ""}
          />
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
        </PageContainer>
      </ScrollView>
    </ThemedView>
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
