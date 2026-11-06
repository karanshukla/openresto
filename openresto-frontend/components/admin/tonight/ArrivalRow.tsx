import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import RowTextButton from "@/components/common/RowTextButton";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { fmtTimeInZone } from "@/utils/formatters";
import { minutesUntil } from "@/utils/tonight";
import type { BookingDetailDto, BookingStatus } from "@/api/admin";
import { styles } from "./ArrivalRow.styles";

/**
 * One party due tonight. The moves come from the server's `nextStatuses`, so a button is never
 * offered that would come back refused; Seat puts the party at the table they booked, and
 * Choose table hands them to the floor to pick another.
 *
 * @see [ArrivalRow.test.tsx](../../../tests/components/admin/tonight/ArrivalRow.test.tsx) — pins
 * the late/due wording, each move following `nextStatuses`, Seat withheld while the booked
 * table is taken, and Choose table hidden for a group booking.
 */
export function ArrivalRow({
  booking,
  nowMs,
  timezone,
  choosing,
  ownTableFree,
  busy,
  isLast,
  onSetStatus,
  onChooseTable,
}: {
  booking: BookingDetailDto;
  nowMs: number;
  timezone: string;
  /** This party is the one being placed on the floor. */
  choosing: boolean;
  /** The booked table can take them now (free, or held for them). */
  ownTableFree: boolean;
  busy: boolean;
  isLast: boolean;
  onSetStatus: (status: BookingStatus) => void;
  onChooseTable: () => void;
}) {
  const { t } = useTranslation();
  const { colors, isDark, primaryColor } = useAppTheme();
  const moves = booking.nextStatuses ?? [];
  const name = booking.customerName || t("admin.tonight.party.hidden");
  const minutes = minutesUntil(booking.date, nowMs);
  const late = minutes < 0;
  const lateTone = theme.floor.overdue.text;
  const arrived = booking.status === "Arrived";
  const arrivedTone = theme.floor.free;
  const isGroup = booking.tableGroupId != null;

  return (
    <View
      testID={`arrival-${booking.id}`}
      style={[
        styles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
        choosing && [
          styles.selected,
          { borderLeftColor: primaryColor, backgroundColor: colors.surfaceAlt },
        ],
      ]}
    >
      <View style={styles.top}>
        <View style={styles.when}>
          <ThemedText style={styles.time} numberOfLines={1}>
            {fmtTimeInZone(booking.date, timezone)}
          </ThemedText>
          <ThemedText
            style={[
              styles.relative,
              { color: late ? (isDark ? lateTone.dark : lateTone.light) : colors.muted },
            ]}
          >
            {late
              ? t("admin.tonight.party.lateBy", { minutes: -minutes })
              : t("admin.tonight.party.inMinutes", { minutes })}
          </ThemedText>
        </View>

        <View style={styles.main}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {name}
            </ThemedText>
            {arrived && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: isDark ? arrivedTone.bg.dark : arrivedTone.bg.light },
                ]}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    { color: isDark ? arrivedTone.text.dark : arrivedTone.text.light },
                  ]}
                >
                  {t("admin.tonight.party.checkedIn")}
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.meta, { color: colors.muted }]}>
            {t("admin.tonight.party.guests", { count: booking.seats })} · {booking.tableName}
          </ThemedText>
          {booking.specialRequests ? (
            <View style={styles.note}>
              <Icon name="chatbubble-ellipses-outline" size="xs" color={colors.muted} />
              <ThemedText style={[styles.noteText, { color: colors.muted }]} numberOfLines={2}>
                {booking.specialRequests}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.actions}>
        {moves.includes("NoShow") && (
          <RowTextButton
            label={t("admin.tonight.tile.noShow")}
            accessibilityLabel={t("admin.tonight.tile.noShowLabel", { name })}
            color={colors.error}
            disabled={busy}
            onPress={() => onSetStatus("NoShow")}
            testID={`arrival-noshow-${booking.id}`}
          />
        )}
        {!isGroup && moves.includes("Seated") && (
          <RowTextButton
            label={t("admin.tonight.arrivals.chooseTable")}
            accessibilityLabel={t("admin.tonight.arrivals.chooseTableLabel", { name })}
            color={primaryColor}
            icon="grid-outline"
            selected={choosing}
            disabled={busy}
            onPress={onChooseTable}
            testID={`arrival-choose-${booking.id}`}
          />
        )}
        {moves.includes("Arrived") && (
          <RowTextButton
            label={t("admin.tonight.arrivals.arrived")}
            accessibilityLabel={t("admin.tonight.arrivals.arrivedLabel", { name })}
            color={primaryColor}
            icon="hand-left-outline"
            disabled={busy}
            onPress={() => onSetStatus("Arrived")}
            testID={`arrival-arrived-${booking.id}`}
          />
        )}
        {moves.includes("Seated") && (
          <RowTextButton
            label={t("admin.tonight.tile.seat")}
            accessibilityLabel={t("admin.tonight.arrivals.seatLabel", {
              name,
              table: booking.tableName,
            })}
            color={isDark ? colors.success : theme.status.arrived.text}
            icon="checkmark"
            disabled={busy || !ownTableFree}
            onPress={() => onSetStatus("Seated")}
            testID={`arrival-seat-${booking.id}`}
          />
        )}
      </View>
    </View>
  );
}
