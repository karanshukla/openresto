import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  getAdminBooking,
  adminDeleteBooking,
  adminExtendBooking,
  adminPurgeBooking,
  sendBookingEmail,
  BookingDetailDto,
} from "@/api/admin";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";

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
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const mutedColor = colors.muted;

  useEffect(() => {
    if (!id) return;
    getAdminBooking(parseInt(id, 10)).then((b) => {
      setBooking(b);
      setLoading(false);
    });
  }, [id]);

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
  const durationMins = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

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
      value: `${startTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} – ${endTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} (${durationMins} min)`,
    },
    { label: "Party", value: `${booking.seats} guest${booking.seats !== 1 ? "s" : ""}` },
    { label: "Restaurant", value: booking.restaurantName },
    { label: "Section", value: booking.sectionName },
    { label: "Table", value: booking.tableName },
  ];

  if (booking.specialRequests) {
    rows.push({ label: "Requests", value: booking.specialRequests });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />
        <ThemedText style={[styles.backText, { color: COLORS.primary }]}>Bookings</ThemedText>
      </Pressable>

      <ThemedText style={styles.pageTitle}>Booking Details</ThemedText>

      {/* Detail card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor }]}>
        {rows.map(({ label, value }, i) => (
          <View key={label}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: borderColor }]} />}
            <View style={styles.row}>
              <ThemedText style={[styles.rowLabel, { color: mutedColor }]}>{label}</ThemedText>
              <ThemedText style={styles.rowValue}>{value}</ThemedText>
            </View>
          </View>
        ))}
      </View>

      {/* Extend duration */}
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
              style={[styles.extendBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => handleExtend(mins)}
              disabled={extending}
            >
              <ThemedText style={styles.extendBtnText}>+{mins} min</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Email guest */}
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

      {/* Cancel */}
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
  extendBtns: { flexDirection: "row", gap: 10 },
  extendBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    cursor: "pointer" as any,
  },
  extendBtnText: { fontSize: 14, fontWeight: "600" },
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
