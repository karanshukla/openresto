import { Modal, Pressable, ScrollView, View, ActivityIndicator } from "react-native";
import { scrollIntoView } from "@/utils/scrollIntoView";
import { ThemedText } from "@/components/themed-text";
import {
  getAdminBooking,
  adminDeleteBooking,
  adminExtendBooking,
  adminPurgeBooking,
  sendBookingEmail,
  adminRestoreBooking,
  adminUpdateBookingFull,
  BookingDetailDto,
  AdminUpdateBookingRequest,
} from "@/api/admin";
import { fetchRestaurants, RestaurantDto, SectionDto } from "@/api/restaurants";
import { useEffect, useRef, useState } from "react";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";

import { bookingDetailStyles as styles } from "./booking-detail.styles";
import { BookingDetailsCard } from "./BookingDetailsCard";
import { EditBookingForm } from "./EditBookingForm";
import { ExtendBookingActions } from "./ExtendBookingActions";
import { EmailGuestForm } from "./EmailGuestForm";
import { composeBookingMoveNotice } from "@/utils/bookingMoveNotice";
import { BookingActionButtons } from "./BookingActionButtons";
import { isPast } from "./StatusBadge";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";

export function BookingDetailPopup({
  bookingId,
  onClose,
  onMutated,
  initialFocus,
}: {
  bookingId: number | null;
  onClose: () => void;
  onMutated?: () => void;
  /** "extend" (bound to the bookings-list "e" shortcut) scrolls the extend
   * section into view once the booking loads, distinguishing it from a plain
   * "open" (Enter). */
  initialFocus?: "extend";
}) {
  const [booking, setBooking] = useState<BookingDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [extending, setExtending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [moveNoticeReady, setMoveNoticeReady] = useState(false);
  const [uncancelling, setUncancelling] = useState(false);
  const [showUncancelConfirm, setShowUncancelConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [editSeats, setEditSeats] = useState("1");
  const [editEmail, setEditEmail] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editSpecialRequests, setEditSpecialRequests] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editTableId, setEditTableId] = useState<number | null>(null);
  const [editSectionId, setEditSectionId] = useState<number | null>(null);
  const [editRestaurantId, setEditRestaurantId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const { colors, isDark, primaryColor: PRIMARY } = useAppTheme();
  const borderColor = colors.border;
  const mutedColor = colors.muted;

  const scrollRef = useRef<ScrollView>(null);
  const extendSectionRef = useRef<View>(null);
  const emailSectionRef = useRef<View>(null);

  // A form that silently fills itself in reads as a glitch. Bringing it into view is what turns
  // the prefill into an offer the admin can act on or ignore.
  useEffect(() => {
    if (!moveNoticeReady) return;
    const timer = setTimeout(
      () => scrollIntoView(emailSectionRef, scrollRef, { block: "center" }),
      150
    );
    return () => clearTimeout(timer);
  }, [moveNoticeReady]);

  useEffect(() => {
    if (initialFocus !== "extend" || loading || editing || !booking || booking.isCancelled) return;
    const timer = setTimeout(
      () => scrollIntoView(extendSectionRef, scrollRef, { block: "center" }),
      150
    );
    return () => clearTimeout(timer);
    // Depend on booking?.id/isCancelled rather than the whole booking object
    // so an in-place update (e.g. a successful extend refreshing endTime)
    // doesn't re-trigger the scroll-into-view animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFocus, loading, editing, booking?.id, booking?.isCancelled]);

  useEffect(() => {
    if (bookingId === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBooking(null);
      setEditing(false);
      setEmailSubject("");
      setEmailBody("");
      setEmailResult(null);
      setMoveNoticeReady(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setBooking(null);
    getAdminBooking(bookingId).then((b) => {
      if (cancelled) return;
      setBooking(b);
      if (b) {
        setEditSeats(String(b.seats));
        setEditEmail(b.customerEmail ?? "");
        setEditCustomerName(b.customerName ?? "");
        setEditSpecialRequests(b.specialRequests ?? "");
        setEditTableId(b.tableId);
        setEditSectionId(b.sectionId);
        setEditRestaurantId(b.restaurantId);

        const d = new Date(b.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        setEditDate(`${year}-${month}-${day}`);
        setEditTime(d.toTimeString().slice(0, 5));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  useEffect(() => {
    if (!editing || restaurants.length > 0) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingRestaurants(true);
    fetchRestaurants()
      .then((data) => {
        if (!cancelled) setRestaurants(data);
      })
      .finally(() => {
        if (!cancelled) setLoadingRestaurants(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, restaurants.length]);

  const selectedRestaurant = restaurants.find((r) => r.id === editRestaurantId) ?? null;
  const sections: SectionDto[] = selectedRestaurant?.sections ?? [];
  const selectedSection = sections.find((s) => s.id === editSectionId);
  const tables = selectedSection?.tables ?? [];

  const handleRestaurantChange = (value: string | number) => {
    const nextId = Number(value);
    setEditRestaurantId(nextId);
    const restaurant = restaurants.find((r) => r.id === nextId);
    const firstSection = restaurant?.sections[0];
    setEditSectionId(firstSection?.id ?? null);
    setEditTableId(firstSection?.tables[0]?.id ?? null);
  };

  const handleSectionChange = (value: string | number) => {
    const nextId = Number(value);
    setEditSectionId(nextId);
    const section = sections.find((s) => s.id === nextId);
    setEditTableId(section?.tables[0]?.id ?? null);
  };

  const handleDeleteConfirmed = async () => {
    if (!booking) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await adminDeleteBooking(booking.id);
      onMutated?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel the booking.";
      setDeleting(false);
      setErrorMessage(message);
    }
  };

  const handleExtend = async (minutes: number) => {
    if (!booking) return;
    setExtending(true);
    const result = await adminExtendBooking(booking.id, minutes);
    if (result) {
      setBooking((prev) => (prev ? { ...prev, endTime: result.endTime } : prev));
      onMutated?.();
    }
    setExtending(false);
  };

  const handleUncancel = async () => {
    if (!booking) return;
    setShowUncancelConfirm(false);
    setUncancelling(true);
    try {
      await adminRestoreBooking(booking.id);
      const updated = await getAdminBooking(booking.id);
      setBooking(updated);
      onMutated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to restore booking.";
      setErrorMessage(message);
    }
    setUncancelling(false);
  };

  const handleSaveEdit = async () => {
    if (!booking) return;
    const seats = parseInt(editSeats, 10);
    if (isNaN(seats) || seats < 1) {
      setErrorMessage("Invalid seats value");
      return;
    }
    if (!editDate || !editTime) {
      setErrorMessage("Date and time are required");
      return;
    }
    setEditLoading(true);
    try {
      const currentRestaurant = restaurants.find((r) => r.id === editRestaurantId);
      const currentTable = currentRestaurant?.sections
        .flatMap((s) => s.tables)
        .find((t) => t.id === editTableId);

      if (currentTable && seats > currentTable.seats) {
        const confirmed = window.confirm(
          `Warning: This table only has ${currentTable.seats} seats, but you are booking for ${seats} guests. Do you want to continue?`
        );
        if (!confirmed) {
          setEditLoading(false);
          return;
        }
      }

      const dateTime = new Date(`${editDate}T${editTime}`);
      const updateData: AdminUpdateBookingRequest = {
        restaurantId: editRestaurantId ?? undefined,
        sectionId: editSectionId ?? undefined,
        tableId: editTableId ?? undefined,
        date: dateTime.toISOString(),
        seats,
        customerEmail: editEmail.trim() || undefined,
        customerName: editCustomerName.trim() || undefined,
        specialRequests: editSpecialRequests.trim() || undefined,
      };

      const movedFrom = booking.date;
      const updated = await adminUpdateBookingFull(booking.id, updateData);
      setBooking(updated);
      setEditing(false);
      onMutated?.();

      // Composing the notice is the step that was missing, not sending it: the admin still reads
      // and sends. Only offered once the write has landed, so a move the conflict check rejected
      // never gets announced to a guest it did not happen to.
      const notice = updated
        ? composeBookingMoveNotice({
            restaurantName: updated.restaurantName,
            bookingRef: updated.bookingRef,
            customerName: updated.customerName,
            fromIso: movedFrom,
            toIso: updated.date,
            timezone: updated.timezone,
          })
        : null;
      if (notice && updated?.customerEmail) {
        setEmailSubject(notice.subject);
        setEmailBody(notice.body);
        setEmailResult(null);
        setMoveNoticeReady(true);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update booking.";
      setErrorMessage(message);
    }
    setEditLoading(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    if (booking) {
      setEditSeats(String(booking.seats));
      setEditEmail(booking.customerEmail ?? "");
      setEditCustomerName(booking.customerName ?? "");
      setEditSpecialRequests(booking.specialRequests ?? "");
      setEditTableId(booking.tableId);
      setEditSectionId(booking.sectionId);
      setEditRestaurantId(booking.restaurantId);
      const bookingDate = new Date(booking.date);
      setEditDate(bookingDate.toISOString().split("T")[0]);
      setEditTime(bookingDate.toTimeString().slice(0, 5));
    }
  };

  const handleSendEmail = async () => {
    if (!booking) return;
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    const result = await sendBookingEmail(booking.id, emailSubject, emailBody);
    setEmailResult(result);
    setEmailSending(false);
    if (result.ok) {
      setEmailSubject("");
      setEmailBody("");
      setMoveNoticeReady(false);
    }
  };

  const restaurantOptions = restaurants.map((r) => ({ label: r.name, value: r.id }));
  const sectionOptions = sections.map((s) => ({ label: s.name, value: s.id }));
  const tableOptions = tables.map((t) => ({
    label: `${t.name ?? `Table ${t.id}`} (${t.seats} seats)`,
    value: t.id,
  }));
  const seatOptions = [...Array(10).keys()].map((i) => ({
    label: `${i + 1} guest${i > 0 ? "s" : ""}`,
    value: i + 1,
  }));

  return (
    <Modal transparent animationType="fade" visible={bookingId !== null} onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay.light,
          alignItems: "center",
          justifyContent: "center",
        }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close booking details"
      >
        <Pressable
          onPress={/* istanbul ignore next */ (e) => e.stopPropagation?.()}
          role="dialog"
          aria-modal
          accessibilityViewIsModal
          accessibilityLabel="Booking details"
          style={{
            width: "92%",
            maxWidth: 960,
            maxHeight: "92%",
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              paddingHorizontal: 20,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
              gap: 12,
            }}
          >
            <ThemedText style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.3 }}>
              Booking Details
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {editing ? (
                <>
                  <Button
                    variant="secondary"
                    tone="neutral"
                    size="md"
                    onPress={handleCancelEdit}
                    disabled={editLoading}
                    accessibilityLabel="Discard changes"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="md"
                    onPress={handleSaveEdit}
                    disabled={editLoading}
                    loading={editLoading}
                    accessibilityLabel="Save changes"
                  >
                    {editLoading ? "Saving…" : "Save Changes"}
                  </Button>
                </>
              ) : (
                booking &&
                !booking.isCancelled && (
                  <Button
                    variant="secondary"
                    size="md"
                    icon="create-outline"
                    onPress={() => setEditing(true)}
                    accessibilityLabel="Edit booking"
                  >
                    Edit
                  </Button>
                )
              )}
              <Pressable
                onPress={onClose}
                style={{ padding: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
              >
                <Icon name="close" size={22} color={mutedColor} />
              </Pressable>
            </View>
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {loading ? (
              <ActivityIndicator size="large" color={PRIMARY} style={{ marginVertical: 40 }} />
            ) : !booking ? (
              <ThemedText style={{ textAlign: "center", color: mutedColor, marginVertical: 40 }}>
                Booking not found.
              </ThemedText>
            ) : (
              <>
                <View style={styles.twoCol}>
                  <View style={styles.colLeft}>
                    <BookingDetailsCard
                      booking={booking}
                      borderColor={borderColor}
                      mutedColor={mutedColor}
                      cardColor={colors.card}
                    />
                  </View>

                  <View style={styles.colRight}>
                    {editing ? (
                      <EditBookingForm
                        borderColor={borderColor}
                        loadingRestaurants={loadingRestaurants}
                        restaurantOptions={restaurantOptions}
                        sectionOptions={sectionOptions}
                        tableOptions={tableOptions}
                        seatOptions={seatOptions}
                        editRestaurantId={editRestaurantId}
                        editSectionId={editSectionId}
                        editTableId={editTableId}
                        editSeats={editSeats}
                        editEmail={editEmail}
                        editCustomerName={editCustomerName}
                        editSpecialRequests={editSpecialRequests}
                        editDate={editDate}
                        editTime={editTime}
                        selectedRestaurant={selectedRestaurant}
                        setEditTableId={setEditTableId}
                        setEditSeats={setEditSeats}
                        setEditEmail={setEditEmail}
                        setEditCustomerName={setEditCustomerName}
                        setEditSpecialRequests={setEditSpecialRequests}
                        setEditDate={setEditDate}
                        setEditTime={setEditTime}
                        handleRestaurantChange={handleRestaurantChange}
                        handleSectionChange={handleSectionChange}
                      />
                    ) : !booking.isCancelled ? (
                      <View style={{ gap: 16 }}>
                        <View ref={extendSectionRef} testID="extend-section">
                          <ExtendBookingActions
                            borderColor={borderColor}
                            mutedColor={mutedColor}
                            extending={extending}
                            onExtend={handleExtend}
                          />
                        </View>
                        <View ref={emailSectionRef} testID="email-section">
                          <EmailGuestForm
                            moveNoticeReady={moveNoticeReady}
                            borderColor={borderColor}
                            mutedColor={mutedColor}
                            isDark={isDark}
                            colors={colors}
                            customerEmail={booking.customerEmail}
                            emailSubject={emailSubject}
                            emailBody={emailBody}
                            emailSending={emailSending}
                            emailResult={emailResult}
                            setEmailSubject={setEmailSubject}
                            setEmailBody={setEmailBody}
                            onSendEmail={handleSendEmail}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>

                <BookingActionButtons
                  isCancelled={!!booking.isCancelled}
                  isPast={isPast(booking.date)}
                  uncancelling={uncancelling}
                  deleting={deleting}
                  onUncancel={() => setShowUncancelConfirm(true)}
                  onCancel={() => setShowDeleteConfirm(true)}
                  onPurge={() => setShowPurgeConfirm(true)}
                />
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This cannot be undone."
        confirmLabel="Cancel Booking"
        cancelLabel="Keep"
        destructive
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmModal
        visible={showUncancelConfirm}
        title="Restore Booking"
        message="Are you sure you want to restore this cancelled booking?"
        confirmLabel="Restore"
        cancelLabel="Go Back"
        onConfirm={handleUncancel}
        onCancel={() => setShowUncancelConfirm(false)}
      />

      <ConfirmModal
        visible={showPurgeConfirm}
        title="Permanently Delete"
        message="This will permanently erase all data for this booking including the guest's email and personal details. This action cannot be reversed."
        confirmLabel="Delete Forever"
        cancelLabel="Go Back"
        destructive
        onConfirm={async () => {
          if (!booking) return;
          setShowPurgeConfirm(false);
          setDeleting(true);
          const ok = await adminPurgeBooking(booking.id);
          if (ok) {
            onMutated?.();
            onClose();
          } else {
            setDeleting(false);
            setErrorMessage("Failed to permanently delete the booking.");
          }
        }}
        onCancel={() => setShowPurgeConfirm(false)}
      />

      <AlertModal
        visible={!!errorMessage}
        title="Error"
        message={errorMessage ?? ""}
        onClose={() => setErrorMessage(null)}
      />
    </Modal>
  );
}
