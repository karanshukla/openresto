import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import TimePicker from "@/components/common/TimePicker";
import { COLORS, getThemeColors } from "@/theme/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { RestaurantDto, updateRestaurant } from "@/api/restaurants";
import { useBrand } from "@/context/BrandContext";
import { Ionicons } from "@expo/vector-icons";

const TIMEZONES = [
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
];

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function RestaurantInfoForm({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
}) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  const mutedColor = colors.muted;
  const borderColor = colors.border;
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [openTime, setOpenTime] = useState(restaurant.openTime ?? "09:00");
  const [closeTime, setCloseTime] = useState(restaurant.closeTime ?? "22:00");
  const [openDays, setOpenDays] = useState<number[]>(
    (restaurant.openDays ?? "1,2,3,4,5,6,7").split(",").map(Number)
  );
  const [timezone, setTimezone] = useState(restaurant.timezone ?? "UTC");
  const [tags, setTags] = useState<string[]>(restaurant.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

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
    timezone !== (restaurant.timezone ?? "UTC") ||
    tags.join(",") !== (restaurant.tags ?? []).join(",");

  const discard = () => {
    setName(restaurant.name);
    setAddress(restaurant.address ?? "");
    setOpenTime(restaurant.openTime ?? "09:00");
    setCloseTime(restaurant.closeTime ?? "22:00");
    setOpenDays((restaurant.openDays ?? "1,2,3,4,5,6,7").split(",").map(Number));
    setTimezone(restaurant.timezone ?? "UTC");
    setTags(restaurant.tags ?? []);
    setTagInput("");
  };

  const save = async () => {
    if (!name.trim()) return;
    // Flush any pending tag the user typed but didn't press Enter on
    const finalTags = tagInput.trim() ? [...new Set([...tags, tagInput.trim()])] : tags;
    if (tagInput.trim()) setTagInput("");
    setSaving(true);
    const result = await updateRestaurant(restaurant.id, {
      name: name.trim(),
      address: address.trim() || null,
      openTime,
      closeTime,
      openDays: openDays.join(","),
      timezone,
      tags: finalTags.join(","),
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
        tags: result.tags,
      });
    }
  };

  return (
    <View>
      {/* Card head */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <View style={{ flex: 1 }}>
          <ThemedText
            style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.2, marginBottom: 4 }}
          >
            Restaurant info
          </ThemedText>
          <ThemedText style={{ fontSize: 13, color: mutedColor }}>
            Name, address, hours and timezone for this location.
          </ThemedText>
        </View>
      </View>

      {/* Form */}
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
            Restaurant name
          </ThemedText>
          <Input value={name} onChangeText={setName} placeholder="Restaurant name" />
        </View>

        <View style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
            Address
          </ThemedText>
          <Input value={address} onChangeText={setAddress} placeholder="e.g. 123 Main St" />
        </View>

        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
              Opens
            </ThemedText>
            <TimePicker
              selectedTime={openTime}
              onSelect={setOpenTime}
              minTime="00:00"
              maxTime="23:45"
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
              Closes
            </ThemedText>
            <TimePicker
              selectedTime={closeTime}
              onSelect={setCloseTime}
              minTime="00:00"
              maxTime="23:45"
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
              Timezone
            </ThemedText>
            <select
              value={timezone}
              onChange={/* istanbul ignore next */ (e) => setTimezone(e.target.value)}
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
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
            Open days
          </ThemedText>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {DAY_LABELS.map((label, i) => {
              const day = i + 1;
              const active = openDays.includes(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => toggleDay(day)}
                  style={{
                    flex: 1,
                    backgroundColor: active ? primaryColor : surface2,
                    borderWidth: 1,
                    borderColor: active ? primaryColor : borderColor,
                    borderRadius: 9,
                    paddingVertical: 10,
                    alignItems: "center",
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 12,
                      fontWeight: "500",
                      color: active ? "#fff" : colors.text,
                    }}
                  >
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            {openDays.length} of 7 days open
          </ThemedText>
        </View>

        {/* Location tags */}
        <View style={{ gap: 6 }}>
          <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
            Location tags
          </ThemedText>
          {tags.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
              {tags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: surface2,
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 999,
                    paddingLeft: 10,
                    paddingRight: 6,
                    paddingVertical: 4,
                  }}
                >
                  <ThemedText style={{ fontSize: 12 }}>{tag}</ThemedText>
                  <Pressable onPress={() => removeTag(tag)} testID={`remove-tag-${tag}`}>
                    <Ionicons name="close" size={12} color={mutedColor} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                value={tagInput}
                onChangeText={setTagInput}
                placeholder="Add tag (press Enter)"
                onSubmitEditing={() => addTag(tagInput)}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
              />
            </View>
            <Pressable
              onPress={() => addTag(tagInput)}
              disabled={!tagInput.trim()}
              style={{
                opacity: tagInput.trim() ? 1 : 0.4,
                backgroundColor: primaryColor,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                justifyContent: "center",
              }}
            >
              <Ionicons name="add" size={18} color="#fff" />
            </Pressable>
          </View>
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            Short labels shown on the public restaurant card (e.g. "Dog friendly", "Terrace").
          </ThemedText>
        </View>
      </View>

      {/* Dashed separator */}
      <View
        style={{ marginTop: 20, borderTopWidth: 1, borderStyle: "dashed" as const, borderColor }}
      />

      {/* Save bar */}
      <View
        style={{
          paddingTop: 14,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {dirty ? (
            <>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#f59e0b" }} />
              <ThemedText style={{ fontSize: 12, color: mutedColor }}>Unsaved changes</ThemedText>
            </>
          ) : (
            <>
              <Ionicons name="checkmark" size={13} color={mutedColor} />
              <ThemedText style={{ fontSize: 12, color: mutedColor }}>All changes saved</ThemedText>
            </>
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={discard}
            disabled={!dirty}
            style={{
              opacity: dirty ? 1 : 0.4,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <ThemedText style={{ fontSize: 14, color: mutedColor, fontWeight: "500" }}>
              Discard
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={save}
            disabled={!dirty || saving || !name.trim()}
            style={{
              opacity: !dirty || saving || !name.trim() ? 0.5 : 1,
              backgroundColor: primaryColor,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons name="checkmark" size={14} color="#fff" />
            <ThemedText style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
              {saving ? "Saving…" : "Save changes"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
