import { View, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { COLORS } from "@/theme/theme";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import TimePicker from "@/components/common/TimePicker";
import { bookingDetailStyles as styles } from "./booking-detail.styles";

interface RestaurantDto {
  openTime?: string;
  closeTime?: string;
}

interface EditBookingFormProps {
  borderColor: string;
  loadingRestaurants: boolean;
  restaurantOptions: { label: string; value: number }[];
  sectionOptions: { label: string; value: number }[];
  tableOptions: { label: string; value: number }[];
  seatOptions: { label: string; value: number }[];
  editRestaurantId: number | null;
  editSectionId: number | null;
  editTableId: number | null;
  editSeats: string;
  editEmail: string;
  editSpecialRequests: string;
  editDate: string;
  editTime: string;
  selectedRestaurant: RestaurantDto | null;
  setEditTableId: (id: number) => void;
  setEditSeats: (s: string) => void;
  setEditEmail: (e: string) => void;
  setEditSpecialRequests: (s: string) => void;
  setEditDate: (d: string) => void;
  setEditTime: (t: string) => void;
  handleRestaurantChange: (v: string | number) => void;
  handleSectionChange: (v: string | number) => void;
}

export function EditBookingForm({
  borderColor,
  loadingRestaurants,
  restaurantOptions,
  sectionOptions,
  tableOptions,
  seatOptions,
  editRestaurantId,
  editSectionId,
  editTableId,
  editSeats,
  editEmail,
  editSpecialRequests,
  editDate,
  editTime,
  selectedRestaurant,
  setEditTableId,
  setEditSeats,
  setEditEmail,
  setEditSpecialRequests,
  setEditDate,
  setEditTime,
  handleRestaurantChange,
  handleSectionChange,
}: EditBookingFormProps) {
  return (
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
  );
}
