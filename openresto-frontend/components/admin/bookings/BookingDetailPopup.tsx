import { Modal, Pressable, ScrollView, View, ActivityIndicator } from "react-native";
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
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";

import { bookingDetailStyles as styles } from "./booking-detail.styles";
import { BookingDetailsCard } from "./BookingDetailsCard";
import { EditBookingForm } from "./EditBookingForm";
import { ExtendBookingActions } from "./ExtendBookingActions";
import { EmailGuestForm } from "./EmailGuestForm";
import { BookingActionButtons } from "./BookingActionButtons";

export function BookingDetailPopup({
  bookingId,
  onClose,
  onDeleted,
}: {
  bookingId: number | null;
  onClose: () => void;
  onDeleted?: () => void;
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
  const [uncancelling, setUncancelling] = useState(false);
  const [showUncancelConfirm, setShowUncancelConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [editSeats, setEditSeats] = useState("1");
  const [editEmail, setEditEmail] = useState("");
  const [editSpecialRequests, setEditSpecialRequests] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editTableId, setEditTableId] = useState<number | null>(null);
  const [editSectionId, setEditSectionId] = useState<number | null>(null);
  const [editRestaurantId, setEditRestaurantId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const mutedColor = colors.muted;
  const brand = useBrand();
  const PRIMARY = brand.primaryColor || COLORS.primary;

  useEffect(() => {
    if (bookingId === null) {
      setBooking(null);
      setEditing(false);
      setEmailSubject("");
      setEmailBody("");
      setEmailResult(null);
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
    const ok = await adminDeleteBooking(booking.id);
    if (ok) {
      onDeleted?.();
      onClose();
    } else {
      setDeleting(false);
      setErrorMessage("Failed to cancel the booking.");
    }
  };

  const handleExtend = async (minutes: number) => {
    if (!booking) return;
    setExtending(true);
    const result = await adminExtendBooking(booking.id, minutes);
    if (result) {
      setBooking((prev) => (prev ? { ...prev, endTime: result.endTime } : prev));
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
        specialRequests: editSpecialRequests.trim() || undefined,
      };

      const updated = await adminUpdateBookingFull(booking.id, updateData);
      setBooking(updated);
      setEditing(false);
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
          backgroundColor: "rgba(0,0,0,0.5)",
          alignItems: "center",
          justifyContent: "center",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={/* istanbul ignore next */ (e) => e.stopPropagation?.()}
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
          {/* Header */}
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
                  <Pressable
                    style={[styles.actionBtn, { borderWidth: 1, borderColor: colors.border }]}
                    onPress={handleCancelEdit}
                    disabled={editLoading}
                  >
                    <ThemedText style={[styles.actionBtnText, { color: colors.text }]}>
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: PRIMARY }]}
                    onPress={handleSaveEdit}
                    disabled={editLoading}
                  >
                    <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
                      {editLoading ? "Saving…" : "Save Changes"}
                    </ThemedText>
                  </Pressable>
                </>
              ) : (
                booking &&
                !booking.isCancelled && (
                  <Pressable
                    style={[styles.actionBtn, { borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => setEditing(true)}
                  >
                    <Ionicons name="create-outline" size={16} color={PRIMARY} />
                    <ThemedText style={[styles.actionBtnText, { color: PRIMARY }]}>Edit</ThemedText>
                  </Pressable>
                )
              )}
              <Pressable onPress={onClose} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={mutedColor} />
              </Pressable>
            </View>
          </View>

          {/* Body */}
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
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
                        editSpecialRequests={editSpecialRequests}
                        editDate={editDate}
                        editTime={editTime}
                        selectedRestaurant={selectedRestaurant}
                        setEditTableId={setEditTableId}
                        setEditSeats={setEditSeats}
                        setEditEmail={setEditEmail}
                        setEditSpecialRequests={setEditSpecialRequests}
                        setEditDate={setEditDate}
                        setEditTime={setEditTime}
                        handleRestaurantChange={handleRestaurantChange}
                        handleSectionChange={handleSectionChange}
                      />
                    ) : !booking.isCancelled ? (
                      <View style={{ gap: 16 }}>
                        <ExtendBookingActions
                          borderColor={borderColor}
                          mutedColor={mutedColor}
                          extending={extending}
                          onExtend={handleExtend}
                        />
                        <EmailGuestForm
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
                    ) : null}
                  </View>
                </View>

                <BookingActionButtons
                  isCancelled={!!booking.isCancelled}
                  uncancelling={uncancelling}
                  deleting={deleting}
                  mutedColor={mutedColor}
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
            onDeleted?.();
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
