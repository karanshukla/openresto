import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import TimePicker from "@/components/common/TimePicker";
import { getHoursForDate } from "@/utils/openingHours";
import Button from "@/components/common/Button";
import ConfirmModal from "@/components/common/ConfirmModal";
import { fetchRestaurants, RestaurantDto, SectionDto } from "@/api/restaurants";
import { adminCreateBooking } from "@/api/admin";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function nextSlotTime(openTime = "09:00", closeTime = "22:00") {
  const now = new Date();
  let h = now.getHours();
  const min = now.getMinutes();
  const m = min < 15 ? 15 : min < 30 ? 30 : min < 45 ? 45 : 0;
  if (m === 0) h += 1;
  const [openH] = openTime.split(":").map(Number);
  const [closeH] = closeTime.split(":").map(Number);
  if (h < openH || h >= closeH) return `${(openH + 1).toString().padStart(2, "0")}:00`;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

interface NewBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (bookingId: number) => void;
}

export function NewBookingModal({ visible, onClose, onCreated }: NewBookingModalProps) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const mutedColor = colors.muted;
  const brand = useBrand();
  const PRIMARY = brand.primaryColor || COLORS.primary;

  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);

  const [restaurantId, setRestaurantId] = useState<number | undefined>();
  const [sectionId, setSectionId] = useState<number | undefined>();
  const [tableId, setTableId] = useState<number | undefined>();
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(() => nextSlotTime());
  const [seats, setSeats] = useState(2);
  const [email, setEmail] = useState("");
  const [guestName, setGuestName] = useState("");

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      if (data.length > 0) {
        const r = data[0];
        setRestaurantId(r.id);
        const todayHours = getHoursForDate(r, todayDate());
        setTime(nextSlotTime(todayHours.open, todayHours.close));
        const firstSection = r.sections[0];
        if (firstSection) {
          setSectionId(firstSection.id);
          setTableId(firstSection.tables[0]?.id);
        }
      }
      setLoading(false);
    });
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      setCapacityWarning(null);
      setEmail("");
      setGuestName("");
      setSeats(2);
      setDate(todayDate());
    }
  }, [visible]);

  const selectedRestaurant = restaurants.find((r) => r.id === restaurantId);
  const sections: SectionDto[] = selectedRestaurant?.sections ?? [];
  const selectedSection = sections.find((s) => s.id === sectionId);
  const tables = selectedSection?.tables ?? [];

  const handleRestaurantChange = (id: string | number) => {
    setRestaurantId(id as number);
    const r = restaurants.find((x) => x.id === id);
    const sec = r?.sections[0];
    setSectionId(sec?.id);
    setTableId(sec?.tables[0]?.id);
  };

  const handleSectionChange = (id: string | number) => {
    setSectionId(id as number);
    const sec = sections.find((s) => s.id === id);
    setTableId(sec?.tables[0]?.id);
  };

  const isValid =
    !!restaurantId && !!sectionId && !!tableId && email.includes("@") && !!date && !!time;

  const doSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const isoDate = new Date(`${date}T${time}:00`).toISOString();
      const result = await adminCreateBooking({
        restaurantId: restaurantId!,
        sectionId: sectionId!,
        tableId: tableId!,
        date: isoDate,
        customerEmail: email,
        customerName: guestName.trim() || undefined,
        seats,
      });
      if (result) {
        onCreated(result.id);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create booking.");
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!isValid) return;
    const table = tables.find((t) => t.id === tableId);
    if (table && seats > table.seats) {
      setCapacityWarning(
        `This table only seats ${table.seats} but you're booking for ${seats} guests. Continue anyway?`
      );
      return;
    }
    doSubmit();
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
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor }]}>
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: borderColor }]}>
                <ThemedText style={styles.title}>New Booking</ThemedText>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={mutedColor} />
                </Pressable>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={PRIMARY} />
                </View>
              ) : (
                <ScrollView
                  style={styles.body}
                  contentContainerStyle={styles.bodyContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {error && (
                    <View style={styles.errorBanner}>
                      <ThemedText style={styles.errorText}>{error}</ThemedText>
                    </View>
                  )}

                  <View style={styles.field}>
                    <ThemedText style={styles.label}>Restaurant</ThemedText>
                    <Select
                      selectedValue={restaurantId}
                      onSelect={handleRestaurantChange}
                      options={restaurantOptions}
                    />
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldHalf, styles.field]}>
                      <ThemedText style={styles.label}>Section</ThemedText>
                      <Select
                        selectedValue={sectionId}
                        onSelect={handleSectionChange}
                        options={sectionOptions}
                      />
                    </View>
                    <View style={[styles.fieldHalf, styles.field]}>
                      <ThemedText style={styles.label}>Table</ThemedText>
                      <Select
                        selectedValue={tableId}
                        onSelect={(v) => setTableId(v as number)}
                        options={tableOptions}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldHalf, styles.field]}>
                      <ThemedText style={styles.label}>Date</ThemedText>
                      <DatePicker selectedDate={date} onSelect={setDate} />
                    </View>
                    <View style={[styles.fieldHalf, styles.field]}>
                      <ThemedText style={styles.label}>Time</ThemedText>
                      <TimePicker
                        selectedTime={time}
                        onSelect={setTime}
                        minTime={getHoursForDate(selectedRestaurant ?? {}, date).open}
                        maxTime={getHoursForDate(selectedRestaurant ?? {}, date).close}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldHalf, styles.field]}>
                      <ThemedText style={styles.label}>Guests</ThemedText>
                      <Select
                        selectedValue={seats}
                        onSelect={(v) => setSeats(v as number)}
                        options={seatOptions}
                      />
                    </View>
                    <View style={[styles.fieldHalf, styles.field]}>
                      <ThemedText style={styles.label}>Guest email</ThemedText>
                      <Input
                        placeholder="guest@example.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <ThemedText style={styles.label}>Guest name (optional)</ThemedText>
                    <Input
                      placeholder="Full name"
                      value={guestName}
                      onChangeText={setGuestName}
                      autoCapitalize="words"
                    />
                  </View>

                  <Button
                    onPress={handleSubmit}
                    disabled={!isValid || submitting}
                    style={{ marginTop: SPACING.sm }}
                  >
                    {submitting ? "Creating…" : "Create Booking"}
                  </Button>
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={!!capacityWarning}
        title="Over Capacity"
        message={capacityWarning ?? ""}
        confirmLabel="Book Anyway"
        cancelLabel="Go Back"
        onConfirm={() => {
          setCapacityWarning(null);
          doSubmit();
        }}
        onCancel={() => setCapacityWarning(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xxl,
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "85%",
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  loadingContainer: {
    padding: SPACING.xxxl,
    alignItems: "center",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.1)",
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  errorText: { ...TYPOGRAPHY.label, color: "#dc2626" },
  field: { gap: SPACING.xs },
  label: { ...TYPOGRAPHY.label },
  fieldRow: { flexDirection: "row", gap: SPACING.md },
  fieldHalf: { flex: 1 },
});
