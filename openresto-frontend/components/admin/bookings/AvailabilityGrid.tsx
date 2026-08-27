import { useMemo } from "react";
import { ScrollView, View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { getThemeColors } from "@/theme/theme";
import { SectionWithTables, BookingDetailDto } from "@/api/admin";
import type { TableGroupDto } from "@/api/restaurants";
import { styles } from "./bookings.styles";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { Icon } from "@/components/common/Icon";
import { getNowInTimezone } from "@/utils/date";
import { useMinuteTick } from "@/hooks/use-minute-tick";
import {
  buildTimeline,
  buildUnitRows,
  formatClockMinutes,
  formatRemaining,
  nowOffset,
  unitKeyFor,
  UNASSIGNED_KEY,
  type TimelinePlacement,
} from "@/utils/bookingTimeline";

/** Width of one hour of service. Everything else on the axis derives from it. */
export const HOUR_W = 76;
export const LABEL_W = 132;
export const HEADER_H = 36;
export const SECTION_H = 26;
/** Height of one sitting bar. A unit needing N lanes gets N of these. */
export const LANE_H = 38;
export const ROW_MIN_H = 48;
const LANE_GAP = 4;
const PX_PER_MINUTE = HOUR_W / 60;
function rowHeight(lanes: number): number {
  return Math.max(ROW_MIN_H, lanes * LANE_H + LANE_GAP * 2);
}

type SittingState = "past" | "current" | "upcoming";

function sittingState(placement: TimelinePlacement, now: number | null): SittingState {
  if (now == null) return "upcoming";
  if (now >= placement.endOffset) return "past";
  return now >= placement.startOffset ? "current" : "upcoming";
}

export function AvailabilityGrid({
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
  /** Combinable groups for the location; each becomes a bookable row of its own. */
  groups?: TableGroupDto[];
  bookings: BookingDetailDto[];
  isDark: boolean;
  onBookingPress: (b: BookingDetailDto) => void;
  openTime?: string;
  closeTime?: string;
  timezone?: string;
  /** Sitting length assumed for a booking stored without an end time. */
  defaultDurationMinutes?: number;
  /** The day being shown ("YYYY-MM-DD"). The now marker only draws on the location's today. */
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
  const headerBg = isDark ? "#28292b" : "#f4f5f6";
  const sectionBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const laneBg = isDark ? "#18191b" : "#fafafa";
  const gridLineColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";

  // `tick` is the dependency: the clock is read fresh each minute so the marker and the
  // remaining-time labels advance without a refetch.
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

  const hasUnassigned = bookings.some((b) => unitKeyFor(b) === UNASSIGNED_KEY);
  const rowGroups = useMemo(
    () => buildUnitRows(sections, groups, { includeUnassigned: hasUnassigned }),
    [sections, groups, hasUnassigned]
  );

  const now = nowOffset(timeline, openTime, nowMinutes);

  const placementsByUnit = useMemo(() => {
    const byUnit: Record<string, TimelinePlacement[]> = {};
    for (const placement of timeline.placements) {
      (byUnit[placement.unitKey] ??= []).push(placement);
    }
    return byUnit;
  }, [timeline]);

  const timelineW = (timeline.endOffset - timeline.startOffset) * PX_PER_MINUTE;
  const totalW = LABEL_W + timelineW;
  const bodyH = rowGroups.reduce(
    (sum, group) =>
      sum +
      SECTION_H +
      group.units.reduce((h, unit) => h + rowHeight(timeline.laneCount[unit.key] ?? 1), 0),
    0
  );

  if (sections.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <Icon name="grid-outline" size={32} color={mutedColor} />
        <ThemedText style={[{ color: mutedColor, marginTop: 10, fontSize: 14 }]}>
          {t("admin.bookings.timetable.noTablesFound")}
        </ThemedText>
      </View>
    );
  }

  // An empty day has nothing to place, and a grid of idle hours says less than one sentence does —
  // for a location open around the clock it says it across 24 columns.
  if (bookings.length === 0) {
    return (
      <View testID="grid-empty-day" style={{ padding: 40, alignItems: "center" }}>
        <Icon name="calendar-outline" size={32} color={mutedColor} />
        <ThemedText style={[{ color: mutedColor, marginTop: 10, fontSize: 14 }]}>
          {dateLabel
            ? t("admin.bookings.timetable.noBookingsOnDay", { date: dateLabel })
            : t("admin.bookings.timetable.noBookingsGeneric")}
        </ThemedText>
      </View>
    );
  }

  const offsetToPx = (offset: number) => (offset - timeline.startOffset) * PX_PER_MINUTE;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width: totalW }}>
        <View
          style={{
            flexDirection: "row",
            height: HEADER_H,
            backgroundColor: headerBg,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
          }}
        >
          <View
            style={{
              width: LABEL_W,
              height: HEADER_H,
              justifyContent: "center",
              paddingHorizontal: 10,
              borderRightWidth: 1,
              borderRightColor: borderColor,
            }}
          >
            <ThemedText style={[styles.gridHeaderText, { color: mutedColor }]}>
              {t("booking.form.tableLabel").toUpperCase()}
            </ThemedText>
          </View>
          <View style={{ width: timelineW }}>
            {timeline.ticks.map(({ offset, label }) => (
              <View
                key={offset}
                style={{
                  position: "absolute",
                  left: offsetToPx(offset),
                  width: HOUR_W,
                  height: HEADER_H,
                  alignItems: "center",
                  justifyContent: "center",
                  borderLeftWidth: 1,
                  borderLeftColor: borderColor,
                }}
              >
                <ThemedText style={[styles.gridHeaderText, { color: mutedColor }]}>
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: bodyH }}>
          {rowGroups.map((group) => (
            <View key={group.key}>
              <View
                style={{
                  height: SECTION_H,
                  flexDirection: "row",
                  backgroundColor: sectionBg,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                  alignItems: "center",
                  paddingHorizontal: 10,
                }}
              >
                <ThemedText style={[styles.gridSectionLabel, { color: mutedColor }]}>
                  {group.name.toUpperCase()}
                </ThemedText>
              </View>

              {group.units.map((unit) => {
                const lanes = timeline.laneCount[unit.key] ?? 1;
                const height = rowHeight(lanes);
                return (
                  <View
                    key={unit.key}
                    style={{
                      flexDirection: "row",
                      height,
                      borderBottomWidth: 1,
                      borderBottomColor: borderColor,
                    }}
                  >
                    <View
                      style={{
                        width: LABEL_W,
                        height,
                        justifyContent: "center",
                        paddingHorizontal: 10,
                        borderRightWidth: 1,
                        borderRightColor: borderColor,
                      }}
                    >
                      <ThemedText style={styles.gridTableName} numberOfLines={1}>
                        {unit.name}
                      </ThemedText>
                      {unit.seats != null && (
                        <ThemedText style={[styles.gridTableSeats, { color: mutedColor }]}>
                          {t("admin.bookings.timetable.peopleAbbrev", { count: unit.seats })}
                        </ThemedText>
                      )}
                    </View>

                    <View style={{ width: timelineW, height, backgroundColor: laneBg }}>
                      {timeline.ticks.map(({ offset }) => (
                        <View
                          key={offset}
                          style={{
                            position: "absolute",
                            left: offsetToPx(offset),
                            top: 0,
                            bottom: 0,
                            width: 1,
                            backgroundColor: gridLineColor,
                          }}
                        />
                      ))}

                      {(placementsByUnit[unit.key] ?? []).map((placement) => {
                        const state = sittingState(placement, now);
                        const guest =
                          placement.booking.customerName ||
                          placement.booking.customerEmail?.split("@")[0] ||
                          t("admin.bookings.timetable.guestFallback");
                        const startLabel = formatClockMinutes(placement.startClockMinutes);
                        const endLabel = formatClockMinutes(
                          placement.startClockMinutes +
                            (placement.endOffset - placement.startOffset)
                        );
                        const remaining =
                          state === "current" && now != null
                            ? formatRemaining(placement.endOffset - now)
                            : null;
                        const sittingLabelKey = remaining
                          ? "admin.bookings.timetable.sittingLabelWithRemaining"
                          : "admin.bookings.timetable.sittingLabel";

                        return (
                          <Pressable
                            key={placement.booking.id}
                            testID={`sitting-${placement.booking.id}`}
                            onPress={() => onBookingPress(placement.booking)}
                            accessibilityRole="button"
                            accessibilityLabel={t(sittingLabelKey, {
                              guest,
                              seats: placement.booking.seats,
                              unit: unit.name,
                              start: startLabel,
                              end: endLabel,
                              remaining,
                            })}
                            style={{
                              position: "absolute",
                              left: offsetToPx(placement.startOffset),
                              width: Math.max(
                                (placement.endOffset - placement.startOffset) * PX_PER_MINUTE,
                                24
                              ),
                              top: LANE_GAP + placement.lane * LANE_H,
                              height: LANE_H - LANE_GAP,
                              borderRadius: 6,
                              borderLeftWidth: 3,
                              borderLeftColor: state === "past" ? mutedColor : PRIMARY,
                              backgroundColor: hexToRgba(
                                PRIMARY,
                                state === "current" ? 0.32 : state === "past" ? 0.08 : 0.16
                              ),
                              paddingHorizontal: 6,
                              justifyContent: "center",
                              opacity: state === "past" ? 0.55 : 1,
                            }}
                          >
                            <ThemedText style={styles.gridBarGuest} numberOfLines={1}>
                              {guest} ·{" "}
                              {t("admin.bookings.timetable.peopleAbbrev", {
                                count: placement.booking.seats,
                              })}
                            </ThemedText>
                            <ThemedText
                              style={[styles.gridBarTime, { color: mutedColor }]}
                              numberOfLines={1}
                            >
                              {remaining ?? `${startLabel}–${endLabel}`}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          {now != null && (
            <View
              testID="now-marker"
              pointerEvents="none"
              style={{
                position: "absolute",
                left: LABEL_W + offsetToPx(now),
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: colors.error,
              }}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
