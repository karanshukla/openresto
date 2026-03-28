import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import TimePicker from "@/components/common/TimePicker";

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export default function AdminBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
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
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const mutedColor = colors.muted;

  useEffect(() => {
    if (!id) return;
    getAdminBooking(parseInt(id, 10)).then((b) => {
      setBooking(b);
      if (b) {
        setEditSeats(String(b.seats));
        setEditEmail(b.customerEmail ?? "");
        setEditSpecialRequests(b.specialRequests ?? "");
        setEditTableId(b.tableId);
        setEditSectionId(b.sectionId);
        setEditRestaurantId(b.restaurantId);
        
        // Parse date and time for editing using local time to avoid UTC day-flipping mismatch
        const d = new Date(b.date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setEditDate(`${year}-${month}-${day}`);
        setEditTime(d.toTimeString().slice(0, 5));
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!editing || restaurants.length > 0) {
      return;
    }

    setLoadingRestaurants(true);
    fetchRestaurants()
      .then((data) => setRestaurants(data))
      .finally(() => setLoadingRestaurants(false));
  }, [editing, restaurants.length]);

  const selectedRestaurant = restaurants.find((r) => r.id === editRestaurantId);
  const sections: SectionDto[] = selectedRestaurant?.sections ?? [];
  const selectedSection = sections.find((s) => s.id === editSectionId);
  const tables = selectedSection?.tables ?? [];

  const handleRestaurantChange = (value: string | number) => {
    const nextRestaurantId = Number(value);
    setEditRestaurantId(nextRestaurantId);
    const restaurant = restaurants.find((r) => r.id === nextRestaurantId);
    const firstSection = restaurant?.sections[0];
    setEditSectionId(firstSection?.id ?? null);
    setEditTableId(firstSection?.tables[0]?.id ?? null);
  };

  const handleSectionChange = (value: string | number) => {
    const nextSectionId = Number(value);
    setEditSectionId(nextSectionId);
    const section = sections.find((s) => s.id === nextSectionId);
    setEditTableId(section?.tables[0]?.id ?? null);
  };

  const handleDeleteConfirmed = async () => {
    if (!booking) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    const ok = await adminDeleteBooking(booking.id);
    if (ok) {
      router.back();
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
    } catch (err: any) {
      setErrorMessage(err.message ?? "Failed to restore booking.");
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
    
    // Validate date and time
    if (!editDate || !editTime) {
      setErrorMessage("Date and time are required");
      return;
    }
    
    setEditLoading(true);
    try {
      // Check seat capacity warning
      const currentRestaurant = restaurants.find(r => r.id === editRestaurantId);
      const currentTable = currentRestaurant?.sections
        .flatMap(s => s.tables)
        .find(t => t.id === editTableId);
      
      if (currentTable && seats > currentTable.seats) {
        const confirmed = window.confirm(
          `Warning: This table only has ${currentTable.seats} seats, but you are booking for ${seats} guests. Do you want to continue?`
        );
        if (!confirmed) {
          setEditLoading(false);
          return;
        }
      }

      // Combine date and time
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
    } catch (err: any) {
      setErrorMessage(err.message ?? "Failed to update booking.");
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
      setEditDate(bookingDate.toISOString().split('T')[0]);
      setEditTime(bookingDate.toTimeString().slice(0, 5));
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

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </ThemedView>
    );
  }

  if (!booking) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Booking not found.</ThemedText>
      </ThemedView>
    );
  }

  const startTime = new Date(booking.date);
  const endTime = booking.endTime
    ? new Date(booking.endTime)
    : new Date(startTime.getTime() + 60 * 60 * 1000);
  
  // Safety check for duration calculation
  const diffMs = endTime.getTime() - startTime.getTime();
  const durationMins = Math.round(diffMs / 60000);

  // Formatting time display to handle potential date crossings or timezone weirdness
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString(undefined, { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });
  };

  const formatDate = (d: Date) => {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const timeRangeDisplay = startTime.toDateString() === endTime.toDateString()
    ? `${formatTime(startTime)} – ${formatTime(endTime)}`
    : `${formatTime(startTime)} (${formatDate(startTime)}) – ${formatTime(endTime)} (${formatDate(endTime)})`;

  const rows: { label: string; value: string }[] = [
    { label: "Ref", value: booking.bookingRef ?? `#${booking.id}` },
    { label: "Guest", value: booking.customerEmail },
    {
      label: "Date",
      value: startTime.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    {
      label: "Time",
      value: `${timeRangeDisplay} (${durationMins} min)`,
    },
    { label: "Party", value: `${booking.seats} guest${booking.seats !== 1 ? "s" : ""}` },
    { label: "Restaurant", value: booking.restaurantName },
    { label: "Section", value: booking.sectionName },
    { label: "Table", value: booking.tableName },
  ];

  if (booking.specialRequests) {
    rows.push({ label: "Requests", value: booking.specialRequests });
  }

  if (booking.isCancelled) {
    rows.push({ label: "Status", value: "CANCELLED" });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />
        <ThemedText style={[styles.backText, { color: COLORS.primary }]}>Bookings</ThemedText>
      </Pressable>

      <ThemedText style={styles.pageTitle}>Booking Details</ThemedText>

      {/* Edit mode buttons */}
      {editing ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: COLORS.primary, flex: 1 }]} 
            onPress={handleSaveEdit}
            disabled={editLoading}
          >
            <ThemedText style={[styles.actionBtnText, { color: "#fff" }]}>
              {editLoading ? "Saving…" : "Save Changes"}
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { borderWidth: 1, borderColor: colors.border, flex: 1 }]}
            onPress={handleCancelEdit}
            disabled={editLoading}
          >
            <ThemedText style={[styles.actionBtnText, { color: colors.text }]}>Cancel</ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.actionBtn, { borderWidth: 1, borderColor: colors.border }]}
          onPress={() => setEditing(true)}
          disabled={booking.isCancelled}
        >
          <Ionicons name="create-outline" size={16} color={booking.isCancelled ? colors.muted : COLORS.primary} />
          <ThemedText style={[styles.actionBtnText, { color: booking.isCancelled ? colors.muted : COLORS.primary }]}>
            Edit Booking
          </ThemedText>
        </Pressable>
      )}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor }]}>
        {rows.map(({ label, value }, i) => (
          <View key={label}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
            <View style={styles.row}>
              <ThemedText style={[styles.rowLabel, { color: mutedColor }]}>{label}</ThemedText>
              <ThemedText
                style={[
                  styles.rowValue,
                  label === "Status" && value === "CANCELLED" && { color: COLORS.error, fontWeight: "700" },
                ]}
              >
                {value}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {editing && (
        <View style={[styles.section, { borderColor }]}>
          {loadingRestaurants ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <>
              <ThemedText style={styles.label}>Restaurant</ThemedText>
              <Select
                selectedValue={editRestaurantId ?? undefined}
                onSelect={handleRestaurantChange}
                options={restaurantOptions}
              />

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.label}>Section</ThemedText>
                  <Select
                    selectedValue={editSectionId ?? undefined}
                    onSelect={handleSectionChange}
                    options={sectionOptions}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.label}>Table</ThemedText>
                  <Select
                    selectedValue={editTableId ?? undefined}
                    onSelect={(v) => setEditTableId(v as number)}
                    options={tableOptions}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.label}>Date</ThemedText>
                  <DatePicker selectedDate={editDate} onSelect={setEditDate} />
                </View>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.label}>Time</ThemedText>
                  <TimePicker
                    selectedTime={editTime}
                    onSelect={setEditTime}
                    minTime={selectedRestaurant?.openTime ?? "09:00"}
                    maxTime={selectedRestaurant?.closeTime ?? "22:00"}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.label}>Guests</ThemedText>
                  <Select
                    selectedValue={Number(editSeats)}
                    onSelect={(v) => setEditSeats(String(v))}
                    options={seatOptions}
                  />
                </View>
                <View style={styles.fieldHalf}>
                  <ThemedText style={styles.label}>Guest email</ThemedText>
                  <Input
                    placeholder="guest@example.com"
                    value={editEmail}
                    onChangeText={setEditEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <ThemedText style={styles.label}>Special requests</ThemedText>
              <Input
                placeholder="Dietary needs, occasion, notes"
                value={editSpecialRequests}
                onChangeText={setEditSpecialRequests}
              />
            </>
          )}
        </View>
      )}

      {/* Extend duration - hide for cancelled bookings */}
      {!booking.isCancelled && (
        <View style={[styles.section, { borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={16} color={mutedColor} />
            <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>
              Extend booking
            </ThemedText>
          </View>
          <View style={styles.extendBtns}>
            {[30, 60, 90].map((mins) => (
              <Pressable
                key={mins}
                style={(state) => [
                  styles.extendBtn,
                  { backgroundColor: COLORS.primary },
                  (state as any).hovered && { opacity: 0.9 },
                  extending && { opacity: 0.7 },
                ]}
                onPress={() => handleExtend(mins)}
                disabled={extending}
              >
                <ThemedText style={styles.extendBtnText}>+{mins} min</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Email guest - hide for cancelled bookings */}
      {!booking.isCancelled && (
        <View style={[styles.section, { borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mail-outline" size={16} color={mutedColor} />
            <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>Email guest</ThemedText>
          </View>
          <ThemedText style={[styles.emailTo, { color: mutedColor }]}>
            To: {booking.customerEmail}
          </ThemedText>
          <input
            type="text"
            placeholder="Subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            style={
              {
                width: "100%",
                height: 40,
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                borderRadius: 8,
                paddingLeft: 12,
                paddingRight: 12,
                fontSize: 14,
                backgroundColor: isDark ? "#1c1c1e" : "#fff",
                color: isDark ? "#fff" : "#000",
                marginBottom: 8,
              } as React.CSSProperties
            }
          />
          <textarea
            placeholder="Message body (HTML supported)"
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={4}
            style={
              {
                width: "100%",
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: colors.border,
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                backgroundColor: colors.input,
                color: colors.text,
                resize: "vertical",
                fontFamily: "inherit",
                marginBottom: 8,
              } as React.CSSProperties
            }
          />
          <View style={styles.emailActions}>
            <Pressable
              style={[
                styles.emailSendBtn,
                { backgroundColor: COLORS.primary },
                (!emailSubject.trim() || !emailBody.trim() || emailSending) && { opacity: 0.5 },
              ]}
              onPress={async () => {
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
              }}
              disabled={!emailSubject.trim() || !emailBody.trim() || emailSending}
            >
              <Ionicons name="send-outline" size={14} color="#fff" />
              <ThemedText style={styles.emailSendBtnText}>
                {emailSending ? "Sending…" : "Send Email"}
              </ThemedText>
            </Pressable>
            {emailResult && (
              <ThemedText
                style={[styles.emailResultText, { color: emailResult.ok ? "#16a34a" : "#dc2626" }]}
              >
                {emailResult.message}
              </ThemedText>
            )}
          </View>
        </View>
      )}

      {/* Uncancel - only for cancelled bookings */}
      {booking.isCancelled && (
        <Pressable
          style={[styles.uncancelBtn, uncancelling && { opacity: 0.6 }]}
          onPress={() => setShowUncancelConfirm(true)}
          disabled={uncancelling}
        >
          <Ionicons name="refresh-outline" size={16} color={COLORS.success} />
          <ThemedText style={styles.uncancelBtnText}>
            {uncancelling ? "Restoring…" : "Restore Booking"}
          </ThemedText>
        </Pressable>
      )}

      {/* Cancel - hide if already cancelled */}
      {!booking.isCancelled && (
        <Pressable
          style={[styles.cancelBtn, deleting && { opacity: 0.6 }]}
          onPress={() => setShowDeleteConfirm(true)}
          disabled={deleting}
        >
          <Ionicons name="trash-outline" size={15} color="#dc2626" />
          <ThemedText style={styles.cancelBtnText}>
            {deleting ? "Cancelling…" : "Cancel Booking"}
          </ThemedText>
        </Pressable>
      )}

      {/* Permanent delete (GDPR) */}
      <Pressable
        style={[styles.purgeBtn, deleting && { opacity: 0.6 }]}
        onPress={() => setShowPurgeConfirm(true)}
        disabled={deleting}
      >
        <Ionicons name="nuclear-outline" size={15} color={mutedColor} />
        <ThemedText style={[styles.purgeBtnText, { color: mutedColor }]}>
          Permanently Delete (GDPR)
        </ThemedText>
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
          if (!booking) {
            return;
          }
          setShowPurgeConfirm(false);
          setDeleting(true);
          const ok = await adminPurgeBooking(booking.id);
          if (ok) {
            router.back();
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    padding: 24,
    paddingTop: 32,
    gap: 16,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: "600" },
  pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 16,
  },
  rowLabel: { fontSize: 13, fontWeight: "500", width: 80 },
  rowValue: { fontSize: 14, flex: 1, textAlign: "right" },
  divider: { height: 1 },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldHalf: { flex: 1 },
  extendBtns: { flexDirection: "row", gap: 10 },
  extendBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    cursor: "pointer" as any,
  },
  extendBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  emailTo: { fontSize: 13, marginBottom: 8 },
  emailActions: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  emailSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emailSendBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  emailResultText: { fontSize: 13, fontWeight: "500" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...BUTTON_SIZES.secondary,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 14, fontWeight: "600" },
  uncancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...BUTTON_SIZES.secondary,
    borderRadius: 10,
    backgroundColor: hexToRgba(COLORS.success, 0.1),
    cursor: "pointer" as any,
  },
  uncancelBtnText: { color: COLORS.success, fontSize: 14, fontWeight: "700" },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...BUTTON_SIZES.secondary,
    borderRadius: 10,
    backgroundColor: hexToRgba(COLORS.error, 0.1),
    cursor: "pointer" as any,
  },
  cancelBtnText: { color: COLORS.error, fontSize: 14, fontWeight: "700" },
  purgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...BUTTON_SIZES.secondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.2)", // TODO: Use theme border color
    marginTop: 4,
  },
  purgeBtnText: { fontSize: 13, fontWeight: "600" },
});
