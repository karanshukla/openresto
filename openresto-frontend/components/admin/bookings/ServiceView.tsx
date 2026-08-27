import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { IconButton } from "@/components/common/IconButton";
import Button from "@/components/common/Button";
import { getThemeColors } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMinuteTick } from "@/hooks/use-minute-tick";
import { hexToRgba } from "@/utils/colors";
import { getNowInTimezone } from "@/utils/date";
import type { BookingDetailDto, SectionWithTables } from "@/api/admin";
import type { TableGroupDto } from "@/api/restaurants";
import {
  buildTimeline,
  buildUnitRows,
  clockMinutesAt,
  formatClockMinutes,
  nowOffset,
  unitKeyFor,
  UNASSIGNED_KEY,
  type TimelinePlacement,
} from "@/utils/bookingTimeline";
import {
  buildServiceFloor,
  splitDuration,
  summarise,
  type UnitOccupancy,
  type UnitStatus,
} from "@/utils/serviceView";
import { styles } from "./ServiceView.styles";

/** Scrub granularity. Coarser than a minute so a drag across a service lands on readable times. */
const SCRUB_STEP_MINUTES = 15;

function snap(offset: number, min: number, max: number): number {
  const stepped = Math.round(offset / SCRUB_STEP_MINUTES) * SCRUB_STEP_MINUTES;
  return Math.min(max, Math.max(min, stepped));
}

export function ServiceView({
  sections,
  groups = [],
  bookings,
  isDark,
  onBookingPress,
  openTime = "11:00",
  closeTime = "23:00",
  timezone = "UTC",
  defaultDurationMinutes = 90,
  gridDateIso,
  dateLabel,
}: {
  sections: SectionWithTables[];
  /** Combinable groups for the location; each is a bookable unit beside its member tables. */
  groups?: TableGroupDto[];
  bookings: BookingDetailDto[];
  isDark: boolean;
  onBookingPress: (b: BookingDetailDto) => void;
  openTime?: string;
  closeTime?: string;
  timezone?: string;
  /** Sitting length assumed for a booking stored without an end time. */
  defaultDurationMinutes?: number;
  /** The day being shown ("YYYY-MM-DD"). Scrubbing starts at now only on the location's today. */
  gridDateIso?: string;
  /** Human-readable form of the same day, named in the empty state. */
  dateLabel?: string;
}) {
  const { t } = useTranslation();
  const tick = useMinuteTick();
  const colors = getThemeColors(isDark);
  const { primaryColor: PRIMARY } = useAppTheme();

  const borderColor = colors.border;
  const mutedColor = colors.muted;
  const cardBg = colors.card;

  // `tick` is the dependency: the clock is read fresh each minute so a floor left on "now"
  // advances through service without a refetch.
  const nowMinutes = useMemo(() => {
    const local = getNowInTimezone(timezone);
    if (gridDateIso && gridDateIso !== local.dateStr) return null;
    return local.hours * 60 + local.minutes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone, gridDateIso, tick]);

  const timeline = useMemo(
    () =>
      buildTimeline({
        openTime,
        closeTime,
        timezone,
        bookings,
        defaultDurationMinutes,
        nowMinutes,
      }),
    [openTime, closeTime, timezone, bookings, defaultDurationMinutes, nowMinutes]
  );

  const now = nowOffset(timeline, openTime, nowMinutes);

  /** Null means "follow the clock" — the floor only pins to an offset once staff scrub it. */
  const [scrubbed, setScrubbed] = useState<number | null>(null);

  // A day with no "now" on it (any day but today) has nothing to follow, so the floor opens on its
  // first sitting rather than on the window's edge, which is an hour of empty room by construction.
  const firstSitting = timeline.placements.length
    ? Math.min(...timeline.placements.map((p) => p.startOffset))
    : null;
  const at = scrubbed ?? now ?? firstSitting ?? timeline.startOffset;
  const isLive = scrubbed == null && now != null;

  // Scrubbing is per day and per location: an offset picked against one service window means
  // nothing on the next, and leaving it pinned would show a stale hour as if it were now.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScrubbed(null);
  }, [gridDateIso, openTime, closeTime, timezone]);

  const hasUnassigned = bookings.some((b) => unitKeyFor(b) === UNASSIGNED_KEY);
  const rowGroups = useMemo(
    () => buildUnitRows(sections, groups, { includeUnassigned: hasUnassigned }),
    [sections, groups, hasUnassigned]
  );

  const floor = useMemo(
    () => buildServiceFloor({ rows: rowGroups, placements: timeline.placements, at }),
    [rowGroups, timeline, at]
  );
  const summary = useMemo(() => summarise(floor), [floor]);

  const statusColors: Record<UnitStatus, string> = {
    seated: PRIMARY,
    turning: colors.warning,
    free: mutedColor,
  };

  const duration = (minutes: number): string => {
    const parts = splitDuration(minutes);
    if (parts.hours === 0) return t("admin.bookings.service.durationM", { minutes: parts.minutes });
    if (parts.minutes === 0) return t("admin.bookings.service.durationH", { hours: parts.hours });
    return t("admin.bookings.service.durationHm", parts);
  };

  const clock = (offset: number): string => formatClockMinutes(clockMinutesAt(openTime, offset));

  // --- Scrubber -------------------------------------------------------------------------------

  const [trackW, setTrackW] = useState(0);
  const span = Math.max(1, timeline.endOffset - timeline.startOffset);
  const trackRef = useRef({ width: 0, span, start: timeline.startOffset, end: timeline.endOffset });
  trackRef.current = { width: trackW, span, start: timeline.startOffset, end: timeline.endOffset };

  // Raw responder props rather than a PanResponder: the scrubber only needs where the finger is,
  // not a gesture's velocity or touch history, and this way press and drag are the same handler.
  const scrubTo = (e: GestureResponderEvent) => {
    const { width, span: s, start, end } = trackRef.current;
    if (width <= 0) return;
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / width));
    setScrubbed(snap(start + ratio * s, start, end));
  };

  const step = (delta: number) =>
    setScrubbed(snap(at + delta * SCRUB_STEP_MINUTES, timeline.startOffset, timeline.endOffset));

  const thumbRatio = (at - timeline.startOffset) / span;

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  // --- Render ---------------------------------------------------------------------------------

  const hasUnits = rowGroups.some((row) => row.units.length > 0);

  return (
    <View>
      <View style={[styles.scrubBar, { borderBottomColor: borderColor }]}>
        <IconButton
          name="chevron-back"
          accessibilityLabel={t("admin.bookings.service.earlier", { minutes: SCRUB_STEP_MINUTES })}
          onPress={() => step(-1)}
          color={mutedColor}
          style={styles.scrubNavBtn}
          testID="service-scrub-back"
        />
        <ThemedText
          style={[styles.scrubClock, { color: colors.text }]}
          testID="service-scrub-clock"
        >
          {clock(at)}
        </ThemedText>

        <View
          style={styles.scrubTrack}
          onLayout={onTrackLayout}
          accessibilityRole="adjustable"
          accessibilityLabel={t("admin.bookings.service.scrubLabel")}
          accessibilityValue={{ text: clock(at) }}
          testID="service-scrub-track"
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={scrubTo}
          onResponderMove={scrubTo}
        >
          <View style={[styles.scrubRail, { backgroundColor: hexToRgba(mutedColor, 0.25) }]} />
          <View
            style={[styles.scrubFill, { width: `${thumbRatio * 100}%`, backgroundColor: PRIMARY }]}
          />
          <View
            style={[
              styles.scrubThumb,
              {
                left: `${thumbRatio * 100}%`,
                backgroundColor: PRIMARY,
                borderColor: cardBg,
              },
            ]}
          />
        </View>

        <IconButton
          name="chevron-forward"
          accessibilityLabel={t("admin.bookings.service.later", { minutes: SCRUB_STEP_MINUTES })}
          onPress={() => step(1)}
          color={mutedColor}
          style={styles.scrubNavBtn}
          testID="service-scrub-forward"
        />

        {now != null && (
          <Button
            size="sm"
            variant={isLive ? "primary" : "secondary"}
            onPress={() => setScrubbed(null)}
            accessibilityLabel={t("admin.bookings.service.backToNowLabel")}
            testID="service-scrub-now"
          >
            {t("admin.bookings.service.now")}
          </Button>
        )}
      </View>

      <View style={[styles.summary, { borderBottomColor: borderColor }]}>
        {(["seated", "turning", "free"] as const).map((status) => (
          <View key={status} style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: statusColors[status] }]} />
            <ThemedText style={[styles.summaryText, { color: mutedColor }]}>
              {t(`admin.bookings.service.summary.${status}`, { count: summary[status] })}
            </ThemedText>
          </View>
        ))}
        <ThemedText style={[styles.summaryCovers, { color: colors.text }]} testID="service-covers">
          {t("admin.bookings.service.summary.covers", { count: summary.covers })}
        </ThemedText>
      </View>

      {!hasUnits ? (
        <View style={styles.empty}>
          <Icon name="grid-outline" size={40} color={mutedColor} />
          <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
            {t("admin.bookings.timetable.noTablesFound")}
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={styles.floor}>
          {floor.map((section) => (
            <View key={section.key} style={styles.section}>
              <ThemedText style={[styles.sectionLabel, { color: mutedColor }]}>
                {section.name.toUpperCase()}
              </ThemedText>
              <View style={styles.unitGrid}>
                {section.units.map((occupancy) => (
                  <UnitCard
                    key={occupancy.unit.key}
                    occupancy={occupancy}
                    accent={statusColors[occupancy.status]}
                    cardBg={cardBg}
                    borderColor={borderColor}
                    mutedColor={mutedColor}
                    textColor={colors.text}
                    onPress={onBookingPress}
                    clock={clock}
                    duration={duration}
                  />
                ))}
              </View>
            </View>
          ))}
          {bookings.length === 0 && (
            <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
              {dateLabel
                ? t("admin.bookings.timetable.noBookingsOnDay", { date: dateLabel })
                : t("admin.bookings.timetable.noBookingsGeneric")}
            </ThemedText>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function UnitCard({
  occupancy,
  accent,
  cardBg,
  borderColor,
  mutedColor,
  textColor,
  onPress,
  clock,
  duration,
}: {
  occupancy: UnitOccupancy;
  accent: string;
  cardBg: string;
  borderColor: string;
  mutedColor: string;
  textColor: string;
  onPress: (b: BookingDetailDto) => void;
  clock: (offset: number) => string;
  duration: (minutes: number) => string;
}) {
  const { t } = useTranslation();
  const { unit, status, current, next, minutesRemaining, minutesUntilNext } = occupancy;
  const openable: TimelinePlacement | null = current ?? next;

  // Same fallback chain as the timetable, so one guest is never two different names across the
  // two views of the same service.
  const guest = (placement: TimelinePlacement) =>
    placement.booking.customerName ||
    placement.booking.customerEmail?.split("@")[0] ||
    t("admin.bookings.timetable.guestFallback");

  return (
    <Pressable
      accessibilityRole={openable ? "button" : undefined}
      accessibilityLabel={
        current
          ? t("admin.bookings.service.seatedUnitLabel", {
              unit: unit.name,
              guest: guest(current),
              seats: current.booking.seats,
              remaining: duration(minutesRemaining),
            })
          : t("admin.bookings.service.freeUnitLabel", { unit: unit.name })
      }
      disabled={!openable}
      onPress={() => openable && onPress(openable.booking)}
      testID={`service-unit-${unit.key}`}
      style={[
        styles.unitCard,
        { backgroundColor: cardBg, borderColor, borderLeftColor: accent },
        status === "seated" && { backgroundColor: hexToRgba(accent, 0.07) },
      ]}
    >
      <View style={styles.unitHeader}>
        <ThemedText style={[styles.unitName, { color: textColor }]} numberOfLines={1}>
          {unit.name}
        </ThemedText>
        {unit.seats != null && (
          <ThemedText style={[styles.unitSeats, { color: mutedColor }]}>
            {t("admin.bookings.timetable.peopleAbbrev", { count: unit.seats })}
          </ThemedText>
        )}
      </View>

      <View style={[styles.statusPill, { backgroundColor: hexToRgba(accent, 0.16) }]}>
        <ThemedText style={[styles.statusPillText, { color: accent }]}>
          {t(`admin.bookings.service.status.${status}`)}
        </ThemedText>
      </View>

      {current ? (
        <>
          <View style={styles.guestRow}>
            <ThemedText style={[styles.guestName, { color: textColor }]} numberOfLines={1}>
              {guest(current)}
            </ThemedText>
            <ThemedText style={[styles.guestCovers, { color: mutedColor }]}>
              {t("admin.bookings.timetable.peopleAbbrev", { count: current.booking.seats })}
            </ThemedText>
          </View>
          <ThemedText style={[styles.sittingTimes, { color: mutedColor }]}>
            {t("admin.bookings.service.sittingRange", {
              start: clock(current.startOffset),
              end: clock(current.endOffset),
            })}
          </ThemedText>
          <ThemedText style={[styles.remaining, { color: accent }]}>
            {t("admin.bookings.service.remaining", { duration: duration(minutesRemaining) })}
          </ThemedText>
        </>
      ) : null}

      {next && minutesUntilNext != null ? (
        <ThemedText style={[styles.nextUp, { color: mutedColor }]} numberOfLines={1}>
          {t("admin.bookings.service.nextUp", {
            time: clock(next.startOffset),
            duration: duration(minutesUntilNext),
          })}
        </ThemedText>
      ) : !current ? (
        <ThemedText style={[styles.nextUp, { color: mutedColor }]}>
          {t("admin.bookings.service.nothingElse")}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}
