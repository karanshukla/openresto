import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import TimePicker from "@/components/common/TimePicker";
import { COLORS, getThemeColors } from "@/theme/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { RestaurantDto, updateRestaurant } from "@/api/restaurants";
import { styles } from "./settings.styles";

export function RestaurantInfoForm({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
}) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [openTime, setOpenTime] = useState(restaurant.openTime ?? "09:00");
  const [closeTime, setCloseTime] = useState(restaurant.closeTime ?? "22:00");
  const [openDays, setOpenDays] = useState<number[]>(
    (restaurant.openDays ?? "1,2,3,4,5,6,7").split(",").map(Number)
  );
  const [timezone, setTimezone] = useState(restaurant.timezone ?? "UTC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const toggleDay = (day: number) => {
    setOpenDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const dirty =
    name !== restaurant.name ||
    address !== (restaurant.address ?? "") ||
    openTime !== (restaurant.openTime ?? "09:00") ||
    closeTime !== (restaurant.closeTime ?? "22:00") ||
    openDays.join(",") !== (restaurant.openDays ?? "1,2,3,4,5,6,7") ||
    timezone !== (restaurant.timezone ?? "UTC");

  return (
    <View style={styles.infoForm}>
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Name</ThemedText>
        <Input value={name} onChangeText={setName} placeholder="Restaurant name" />
      </View>
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Address</ThemedText>
        <Input value={address} onChangeText={setAddress} placeholder="e.g. 123 Main St" />
      </View>
      <View style={styles.hoursRow}>
        <View style={styles.hoursField}>
          <ThemedText style={styles.fieldLabel}>Opens</ThemedText>
          <TimePicker
            selectedTime={openTime}
            onSelect={setOpenTime}
          />
        </View>
        <View style={styles.hoursField}>
          <ThemedText style={styles.fieldLabel}>Closes</ThemedText>
          <TimePicker
            selectedTime={closeTime}
            onSelect={setCloseTime}
          />
        </View>
      </View>
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Open Days</ThemedText>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, i) => {
            const day = i + 1;
            const active = openDays.includes(day);
            return (
              <Pressable
                key={day}
                onPress={() => toggleDay(day)}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                    : { borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" },
                ]}
              >
                <ThemedText style={[styles.dayChipText, active && { color: "#fff" }]}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Timezone</ThemedText>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={{
            width: "100%",
            height: 44,
            borderWidth: 1,
            borderStyle: "solid" as const,
            borderColor: colors.border,
            borderRadius: 8,
            paddingLeft: 12,
            paddingRight: 12,
            fontSize: 14,
            backgroundColor: colors.input,
            color: colors.text,
            cursor: "pointer",
          }}
        >
          {[
            "UTC",
            "Europe/London",
            "Europe/Paris",
            "Europe/Berlin",
            "Europe/Madrid",
            "Europe/Rome",
            "Europe/Amsterdam",
            "Europe/Brussels",
            "Europe/Zurich",
            "Europe/Vienna",
            "Europe/Warsaw",
            "Europe/Prague",
            "Europe/Budapest",
            "Europe/Athens",
            "Europe/Helsinki",
            "Europe/Stockholm",
            "Europe/Oslo",
            "Europe/Dublin",
            "Europe/Lisbon",
            "Europe/Moscow",
            "Europe/Istanbul",
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Los_Angeles",
            "America/Toronto",
            "America/Vancouver",
            "America/Mexico_City",
            "America/Sao_Paulo",
            "America/Buenos_Aires",
            "America/Bogota",
            "Asia/Tokyo",
            "Asia/Shanghai",
            "Asia/Hong_Kong",
            "Asia/Singapore",
            "Asia/Seoul",
            "Asia/Kolkata",
            "Asia/Dubai",
            "Asia/Bangkok",
            "Asia/Jakarta",
            "Asia/Kuala_Lumpur",
            "Asia/Manila",
            "Asia/Taipei",
            "Australia/Sydney",
            "Australia/Melbourne",
            "Australia/Perth",
            "Australia/Brisbane",
            "Pacific/Auckland",
            "Africa/Johannesburg",
            "Africa/Cairo",
            "Africa/Lagos",
            "Africa/Nairobi",
          ].map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </View>
      <Button
        onPress={async () => {
          if (!name.trim()) return;
          setSaving(true);
          const result = await updateRestaurant(restaurant.id, {
            name: name.trim(),
            address: address.trim() || null,
            openTime,
            closeTime,
            openDays: openDays.join(","),
            timezone,
          });
          setSaving(false);
          if (result) {
            onSaved({
              name: result.name,
              address: result.address,
              openTime: result.openTime,
              closeTime: result.closeTime,
              openDays: result.openDays,
              timezone: result.timezone,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }
        }}
        disabled={!dirty || saving || !name.trim()}
        style={styles.saveBtn}
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
      </Button>
    </View>
  );
}
