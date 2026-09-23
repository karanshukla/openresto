import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import type { BookingDetailDto, BookingStatus } from "@/api/admin";
import { bookingDetailStyles as styles } from "./booking-detail.styles";
import { StatusBadge } from "./StatusBadge";

function statusName(status: BookingStatus, t: TFunction): string {
  switch (status) {
    case "Arrived":
      return t("admin.bookings.status.arrived");
    case "Seated":
      return t("admin.bookings.status.seated");
    case "Finished":
      return t("admin.bookings.status.finished");
    case "NoShow":
      return t("admin.bookings.status.noShow");
    default:
      return t("admin.bookings.status.booked");
  }
}

/**
 * What has happened at the sitting, and the moves staff can make from here. The server decides
 * which moves are legal (`nextStatuses`, `undoStatus`), so this only offers what it was given.
 *
 * @see [BookingStatusActions.test.tsx](../../../tests/components/admin/bookings/BookingStatusActions.test.tsx)
 * — pins that only the moves the server offered are shown, and that undo names where it goes back to.
 */
export function BookingStatusActions({
  booking,
  busy,
  onSetStatus,
  borderColor,
  mutedColor,
  isDark,
}: {
  booking: BookingDetailDto;
  busy: boolean;
  onSetStatus: (status: BookingStatus) => void;
  borderColor: string;
  mutedColor: string;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const next = booking.nextStatuses ?? [];
  const undo = booking.undoStatus ?? null;

  return (
    <View style={[styles.section, { borderColor }]} testID="status-section">
      <View style={styles.sectionHeader}>
        <Icon name="people-outline" size="md" color={mutedColor} />
        <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>
          {t("admin.bookings.detail.statusActions.title")}
        </ThemedText>
        <View style={styles.statusBadge}>
          <StatusBadge date={booking.date} status={booking.status} isDark={isDark} />
        </View>
      </View>
      {next.length > 0 && (
        <View style={styles.statusBtns}>
          {next.map((status) => (
            <Button
              key={status}
              variant="secondary"
              tone={status === "NoShow" ? "danger" : "brand"}
              size="md"
              onPress={() => onSetStatus(status)}
              disabled={busy}
              accessibilityLabel={t("admin.bookings.detail.statusActions.markAs", {
                status: statusName(status, t),
              })}
            >
              {statusName(status, t)}
            </Button>
          ))}
        </View>
      )}
      {undo && (
        <Button
          variant="ghost"
          tone="neutral"
          size="md"
          icon="arrow-undo-outline"
          onPress={() => onSetStatus(undo)}
          disabled={busy}
          style={styles.statusUndo}
        >
          {t("admin.bookings.detail.statusActions.undo", { status: statusName(undo, t) })}
        </Button>
      )}
    </View>
  );
}
