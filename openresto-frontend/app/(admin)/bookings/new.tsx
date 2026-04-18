import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurants, RestaurantDto, SectionDto } from "@/api/restaurants";
import { adminCreateBooking } from "@/api/admin";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, Platform } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import TimePicker from "@/components/common/TimePicker";
import Button from "@/components/common/Button";
import { getThemeColors, COLORS } from "@/theme/theme";

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

export default function NewBookingScreen() {
  const router = useRouter();

  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const mutedColor = colors.muted;

  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restaurantId, setRestaurantId] = useState<number | undefined>();
  const [sectionId, setSectionId] = useState<number | undefined>();
  const [tableId, setTableId] = useState<number | undefined>();
  const [date, setDate] = useState(todayDate());
  const [time, setTime] = useState(() => nextSlotTime());
  const [seats, setSeats] = useState(2);
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      if (data.length > 0) {
        const r = data[0];
        setRestaurantId(r.id);
        setTime(nextSlotTime(r.openTime, r.closeTime));
        const firstSection = r.sections[0];
        if (firstSection) {
          setSectionId(firstSection.id);
          setTableId(firstSection.tables[0]?.id);
        }
      }
      setLoading(false);
    });
  }, []);

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

  const handleSubmit = async () => {
    if (!isValid) return;

    // Check seat capacity warning
    const table = tables.find((t) => t.id === tableId);
    if (table && seats > table.seats) {
      const confirmed = window.confirm(
        `Warning: This table only has ${table.seats} seats, but you are booking for ${seats} guests. Do you want to continue?`
      );
      if (!confirmed) return;
    }

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
        seats,
      });
      if (result) {
        router.replace(`/(admin)/bookings/${result.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create booking.";
      setError(message);
      setSubmitting(false);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "New Walk-in" }} />}

      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />
        <ThemedText style={[styles.backText, { color: COLORS.primary }]}>Bookings</ThemedText>
      </Pressable>

      <ThemedText style={styles.pageTitle}>New Booking</ThemedText>
      <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
        Walk-in or phone booking — no hold required.
      </ThemedText>

      {error && (
        <View style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor }]}>
        <ThemedText style={styles.label}>Restaurant</ThemedText>
        <Select
          selectedValue={restaurantId}
          onSelect={handleRestaurantChange}
          options={restaurantOptions}
        />

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <ThemedText style={styles.label}>Section</ThemedText>
            <Select
              selectedValue={sectionId}
              onSelect={handleSectionChange}
              options={sectionOptions}
            />
          </View>
          <View style={styles.fieldHalf}>
            <ThemedText style={styles.label}>Table</ThemedText>
            <Select
              selectedValue={tableId}
              onSelect={(v) => setTableId(v as number)}
              options={tableOptions}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <ThemedText style={styles.label}>Date</ThemedText>
            <DatePicker selectedDate={date} onSelect={setDate} />
          </View>
          <View style={styles.fieldHalf}>
            <ThemedText style={styles.label}>Time</ThemedText>
            <TimePicker
              selectedTime={time}
              onSelect={setTime}
              minTime={selectedRestaurant?.openTime ?? "09:00"}
              maxTime={selectedRestaurant?.closeTime ?? "22:00"}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <ThemedText style={styles.label}>Guests</ThemedText>
            <Select
              selectedValue={seats}
              onSelect={(v) => setSeats(v as number)}
              options={seatOptions}
            />
          </View>
          <View style={styles.fieldHalf}>
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
      </View>

      <Button onPress={handleSubmit} disabled={!isValid || submitting}>
        {submitting ? "Creating…" : "Create Booking"}
      </Button>
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
  pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  pageSub: { fontSize: 14, marginTop: -8 },
  errorBanner: { backgroundColor: "rgba(220,38,38,0.1)", borderRadius: 10, padding: 12 },
  errorText: { color: "#dc2626", fontSize: 14 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 4 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldHalf: { flex: 1 },
});
