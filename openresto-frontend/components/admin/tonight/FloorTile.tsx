import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { fmtTimeInZone } from "@/utils/formatters";
import { minutesUntil, type TileFit } from "@/utils/tonight";
import type { BookingDetailDto, BookingStatus } from "@/api/admin";
import type { FloorUnit } from "@/api/tonight";
import { styles } from "./FloorTile.styles";

export interface TilePick {
  fit: TileFit;
  partyName: string;
}

/**
 * One table or combinable group on the host view. Every action is a visible button on the
 * tile, never a tap on the tile itself, so nothing hides behind a gesture and the tile holds
 * no nested press targets. While the host is placing a party (`pick`), the tile swaps its
 * actions for "Seat here", or for the reason it can't take them.
 *
 * @see [FloorTile.test.tsx](../../../tests/components/admin/tonight/FloorTile.test.tsx) — pins
 * the countdown and overdue wording, the actions each state offers, and the pick-mode swap.
 */
export function FloorTile({
  unit,
  label,
  current,
  next,
  nowMs,
  timezone,
  pick,
  busy,
  onSetStatus,
  onSeatHere,
}: {
  unit: FloorUnit;
  label: string;
  current?: BookingDetailDto;
  next?: BookingDetailDto;
  nowMs: number;
  timezone: string;
  pick: TilePick | null;
  busy: boolean;
  onSetStatus: (booking: BookingDetailDto, status: BookingStatus) => void;
  onSeatHere: () => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark, primaryColor } = useAppTheme();
  const tone = theme.floor[unit.state];
  const fg = isDark ? tone.text.dark : tone.text.light;
  const bg = isDark ? tone.bg.dark : tone.bg.light;
  const canTake = pick?.fit === "fits" || pick?.fit === "own";
  const guestName = (b: BookingDetailDto) => b.customerName || t("admin.tonight.party.hidden");

  return (
    <View
      testID={`tile-${unit.kind}-${unit.id}`}
      accessibilityLabel={`${label}, ${t(`admin.tonight.state.${unit.state}`)}`}
      style={[
        styles.tile,
        { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: fg },
        pick && canTake && [styles.target, { borderColor: primaryColor, borderLeftColor: fg }],
        pick && !canTake && styles.dimmed,
      ]}
    >
      <View style={styles.head}>
        <ThemedText style={styles.name} numberOfLines={2}>
          {label}
        </ThemedText>
        <View style={styles.seats}>
          <Icon name="people-outline" size="sm" color={colors.muted} />
          <ThemedText
            style={[styles.seatsText, { color: colors.muted }]}
            accessibilityLabel={t("admin.tonight.tile.seats", { count: unit.seats })}
          >
            {unit.seats}
          </ThemedText>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: bg }]}>
          <ThemedText
            style={[styles.chipText, { color: fg }]}
            testID={`tile-state-${unit.kind}-${unit.id}`}
          >
            {t(`admin.tonight.state.${unit.state}`)}
          </ThemedText>
        </View>
        {unit.walkInOnly && (
          <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
            <Icon name="walk-outline" size="xs" color={colors.muted} />
            <ThemedText style={[styles.chipText, { color: colors.muted }]}>
              {t("admin.tonight.tile.walkIn")}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {(unit.state === "seated" || unit.state === "overdue") && current ? (
          <>
            <ThemedText style={styles.guest} numberOfLines={1}>
              {guestName(current)}
            </ThemedText>
            {unit.currentEndsAt && (
              <ThemedText
                style={[styles.emphasis, { color: unit.state === "overdue" ? fg : colors.text }]}
              >
                {unit.state === "overdue"
                  ? t("admin.tonight.tile.minutesOver", {
                      minutes: Math.max(1, -minutesUntil(unit.currentEndsAt, nowMs)),
                    })
                  : t("admin.tonight.tile.minutesLeft", {
                      minutes: Math.max(0, minutesUntil(unit.currentEndsAt, nowMs)),
                    })}
              </ThemedText>
            )}
          </>
        ) : unit.state === "bookedSoon" && next ? (
          <>
            <ThemedText style={styles.guest} numberOfLines={1}>
              {guestName(next)}
            </ThemedText>
            <ThemedText style={[styles.detail, { color: colors.muted }]}>
              {fmtTimeInZone(next.date, timezone)} ·{" "}
              {t("admin.tonight.party.guests", { count: next.seats })}
            </ThemedText>
            <ThemedText style={[styles.emphasis, { color: fg }]}>{dueText(next.date)}</ThemedText>
          </>
        ) : (
          <ThemedText style={[styles.detail, { color: colors.muted }]}>
            {unit.nextBookingAt
              ? t("admin.tonight.tile.next", { time: fmtTimeInZone(unit.nextBookingAt, timezone) })
              : t("admin.tonight.tile.nothingNext")}
          </ThemedText>
        )}
      </View>

      {pick ? (
        canTake ? (
          <Button
            size="md"
            icon="arrow-down-circle-outline"
            fullWidth
            disabled={busy}
            onPress={onSeatHere}
            accessibilityLabel={t("admin.tonight.tile.seatLabel", {
              name: pick.partyName,
              table: label,
            })}
            testID={`tile-seat-here-${unit.kind}-${unit.id}`}
          >
            {t("admin.tonight.tile.seatHere")}
          </Button>
        ) : (
          <View style={styles.reason}>
            <Icon name="close-circle-outline" size="sm" color={colors.muted} />
            <ThemedText style={[styles.detail, { color: colors.muted }]}>
              {t(
                `admin.tonight.tile.fit.${pick.fit as "taken" | "tooSmall" | "groupMove" | "neededSoon"}`
              )}
            </ThemedText>
          </View>
        )
      ) : (
        tileActions()
      )}
    </View>
  );

  function dueText(iso: string): string {
    const minutes = minutesUntil(iso, nowMs);
    return minutes < 0
      ? t("admin.tonight.party.lateBy", { minutes: -minutes })
      : t("admin.tonight.party.inMinutes", { minutes });
  }

  function tileActions() {
    if ((unit.state === "seated" || unit.state === "overdue") && current) {
      if (!current.nextStatuses?.includes("Finished")) return null;
      return (
        <Button
          size="md"
          // Filled once overdue, so the table waiting to turn is the loudest press on the floor.
          // Brand rather than the warning tone: white on the warning amber is ~2:1.
          variant={unit.state === "overdue" ? "primary" : "secondary"}
          icon="checkmark-done-outline"
          fullWidth
          disabled={busy}
          onPress={() => onSetStatus(current, "Finished")}
          accessibilityLabel={t("admin.tonight.tile.finishLabel", { table: label })}
          testID={`tile-finish-${unit.kind}-${unit.id}`}
        >
          {t("admin.tonight.tile.finish")}
        </Button>
      );
    }
    if (unit.state === "bookedSoon" && next) {
      const moves = next.nextStatuses ?? [];
      if (!moves.includes("Seated") && !moves.includes("NoShow")) return null;
      return (
        <ButtonRow>
          {moves.includes("NoShow") && (
            <Button
              size="md"
              variant="secondary"
              tone="danger"
              disabled={busy}
              onPress={() => onSetStatus(next, "NoShow")}
              accessibilityLabel={t("admin.tonight.tile.noShowLabel", { name: guestName(next) })}
              testID={`tile-noshow-${unit.kind}-${unit.id}`}
            >
              {t("admin.tonight.tile.noShow")}
            </Button>
          )}
          {moves.includes("Seated") && (
            <Button
              size="md"
              disabled={busy}
              onPress={() => onSetStatus(next, "Seated")}
              accessibilityLabel={t("admin.tonight.tile.seatLabel", {
                name: guestName(next),
                table: label,
              })}
              testID={`tile-seat-${unit.kind}-${unit.id}`}
            >
              {t("admin.tonight.tile.seat")}
            </Button>
          )}
        </ButtonRow>
      );
    }
    return null;
  }
}
