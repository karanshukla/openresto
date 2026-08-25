import { useTranslation } from "react-i18next";
import Button from "@/components/common/Button";

interface BookingActionButtonsProps {
  isCancelled: boolean;
  isPast?: boolean;
  uncancelling: boolean;
  deleting: boolean;
  onUncancel: () => void;
  onCancel: () => void;
  onPurge: () => void;
}

/**
 * The booking's own lifecycle actions, stacked full-width in the detail panel: they are the
 * point of the panel, so each takes the column rather than competing for a corner of it.
 */
export function BookingActionButtons({
  isCancelled,
  isPast,
  uncancelling,
  deleting,
  onUncancel,
  onCancel,
  onPurge,
}: BookingActionButtonsProps) {
  const { t } = useTranslation();
  return (
    <>
      {isCancelled && (
        <Button
          variant="secondary"
          tone="success"
          size="md"
          fullWidth
          icon="refresh-outline"
          onPress={onUncancel}
          disabled={uncancelling}
          loading={uncancelling}
          accessibilityLabel={t("admin.bookings.restoreBookingLabel")}
        >
          {uncancelling ? t("admin.bookings.restoring") : t("admin.bookings.restoreBooking")}
        </Button>
      )}

      {!isCancelled && !isPast && (
        <Button
          variant="secondary"
          tone="danger"
          size="md"
          fullWidth
          icon="trash-outline"
          onPress={onCancel}
          disabled={deleting}
          loading={deleting}
          accessibilityLabel={t("admin.bookings.cancelBookingLabel")}
        >
          {deleting ? t("admin.bookings.cancelling") : t("admin.bookings.cancelBookingTitle")}
        </Button>
      )}

      <Button
        variant="secondary"
        tone="neutral"
        size="md"
        fullWidth
        icon="nuclear-outline"
        onPress={onPurge}
        disabled={deleting}
        loading={deleting}
        accessibilityLabel={t("admin.bookings.permanentlyDeleteLabel")}
        accessibilityHint={t("admin.bookings.permanentlyDeleteHint")}
      >
        {t("admin.bookings.permanentlyDeleteGdpr")}
      </Button>
    </>
  );
}
