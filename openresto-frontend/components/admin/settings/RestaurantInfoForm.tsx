import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import TimePicker from "@/components/common/TimePicker";
import { COLORS, getThemeColors } from "@/theme/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { DayHoursDto, RestaurantDto, updateRestaurant } from "@/api/restaurants";
import { getHoursForDay, hasCustomHours, parseOpenDays } from "@/utils/openingHours";
import { parseWalkInDays } from "@/utils/walkIn";
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
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

function formatDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

type WeekHours = Record<number, { open: string; close: string }>;

function initialWeekHours(restaurant: RestaurantDto): WeekHours {
  const week: WeekHours = {};
  for (let day = 1; day <= 7; day++) {
    week[day] = getHoursForDay(restaurant, day);
  }
  return week;
}

function buildOpenHoursPayload(
  customHours: boolean,
  weekHours: WeekHours,
  openTime: string,
  closeTime: string
): DayHoursDto[] {
  const payload: DayHoursDto[] = [];
  for (let day = 1; day <= 7; day++) {
    payload.push(
      customHours
        ? { day, open: weekHours[day].open, close: weekHours[day].close }
        : { day, open: openTime, close: closeTime }
    );
  }
  return payload;
}

function isOvernight(open: string, close: string): boolean {
  return close <= open;
}

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
  const [customHours, setCustomHours] = useState(() => hasCustomHours(restaurant));
  const [weekHours, setWeekHours] = useState<WeekHours>(() => initialWeekHours(restaurant));
  const [openDays, setOpenDays] = useState<number[]>(parseOpenDays(restaurant.openDays));
  const [walkInOnly, setWalkInOnly] = useState(!!restaurant.walkInOnly);
  const [walkInDays, setWalkInDays] = useState<number[]>(() =>
    parseWalkInDays(restaurant.walkInDays)
  );
  const [timezone, setTimezone] = useState(restaurant.timezone ?? "UTC");
  const [defaultBookingDurationMinutes, setDefaultBookingDurationMinutes] = useState(
    restaurant.defaultBookingDurationMinutes ?? 60
  );
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

  const toggleWalkInDay = (day: number) => {
    setWalkInDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const setDayHours = (day: number, patch: Partial<{ open: string; close: string }>) => {
    setWeekHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const copyHoursToAllDays = (day: number) => {
    const source = weekHours[day];
    setWeekHours(() => {
      const next: WeekHours = {};
      for (let d = 1; d <= 7; d++) {
        next[d] = { ...source };
      }
      return next;
    });
  };

  const openHoursPayload = buildOpenHoursPayload(customHours, weekHours, openTime, closeTime);
  const initialOpenHours = buildOpenHoursPayload(
    hasCustomHours(restaurant),
    initialWeekHours(restaurant),
    restaurant.openTime ?? "09:00",
    restaurant.closeTime ?? "22:00"
  );
  const hoursDirty = JSON.stringify(openHoursPayload) !== JSON.stringify(initialOpenHours);

  const dirty =
    name !== restaurant.name ||
    address !== (restaurant.address ?? "") ||
    hoursDirty ||
    openDays.join(",") !== parseOpenDays(restaurant.openDays).join(",") ||
    walkInOnly !== !!restaurant.walkInOnly ||
    walkInDays.join(",") !== parseWalkInDays(restaurant.walkInDays).join(",") ||
    timezone !== (restaurant.timezone ?? "UTC") ||
    defaultBookingDurationMinutes !== (restaurant.defaultBookingDurationMinutes ?? 60) ||
    tags.join(",") !== (restaurant.tags ?? []).join(",");

  const discard = () => {
    setName(restaurant.name);
    setAddress(restaurant.address ?? "");
    setOpenTime(restaurant.openTime ?? "09:00");
    setCloseTime(restaurant.closeTime ?? "22:00");
    setCustomHours(hasCustomHours(restaurant));
    setWeekHours(initialWeekHours(restaurant));
    setOpenDays(parseOpenDays(restaurant.openDays));
    setWalkInOnly(!!restaurant.walkInOnly);
    setWalkInDays(parseWalkInDays(restaurant.walkInDays));
    setTimezone(restaurant.timezone ?? "UTC");
    setDefaultBookingDurationMinutes(restaurant.defaultBookingDurationMinutes ?? 60);
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
      openTime: customHours ? undefined : openTime,
      closeTime: customHours ? undefined : closeTime,
      openHours: openHoursPayload,
      openDays: openDays.join(","),
      walkInOnly,
      walkInDays: walkInDays.join(","),
      timezone,
      defaultBookingDurationMinutes,
      tags: finalTags.join(","),
    });
    setSaving(false);
    if (result) {
      onSaved({
        name: result.name,
        address: result.address,
        openTime: result.openTime,
        closeTime: result.closeTime,
        openHours: result.openHours,
        openDays: result.openDays,
        walkInOnly: result.walkInOnly,
        walkInDays: result.walkInDays,
        timezone: result.timezone,
        defaultBookingDurationMinutes: result.defaultBookingDurationMinutes,
        tags: result.tags,
      });
    }
  };

  const anyOvernight = customHours
    ? openDays.some((d) => isOvernight(weekHours[d].open, weekHours[d].close))
    : isOvernight(openTime, closeTime);

  const modeButton = (label: string, active: boolean, onPress: () => void, testID: string) => (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 7,
        backgroundColor: active ? (isDark ? "#33363a" : "#fff") : "transparent",
        ...(active && {
          borderWidth: 1,
          borderColor,
        }),
      }}
    >
      <ThemedText
        style={{
          fontSize: 12,
          fontWeight: active ? "600" : "500",
          color: active ? colors.text : mutedColor,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

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

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
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
          <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
            <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
              Default Booking duration
            </ThemedText>
            <select
              data-testid="booking-duration-select"
              value={defaultBookingDurationMinutes}
              onChange={
                /* istanbul ignore next */ (e) =>
                  setDefaultBookingDurationMinutes(Number(e.target.value))
              }
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
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDurationLabel(minutes)}
                </option>
              ))}
            </select>
            <ThemedText style={{ fontSize: 11, color: mutedColor }}>
              How long each new booking occupies a table by default
            </ThemedText>
          </View>
        </View>

        {/* Opening hours */}
        <View
          style={{
            gap: 12,
            borderWidth: 1,
            borderColor,
            borderRadius: 12,
            padding: 14,
            backgroundColor: surface2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ gap: 2 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: "600" }}>Opening hours</ThemedText>
              <ThemedText style={{ fontSize: 11, color: mutedColor }}>
                {openDays.length} of 7 days open
              </ThemedText>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 2,
                padding: 3,
                borderRadius: 9,
                backgroundColor: isDark ? "#1b1d1f" : "#eef0f2",
              }}
            >
              {modeButton(
                "Same every day",
                !customHours,
                () => setCustomHours(false),
                "hours-mode-uniform"
              )}
              {modeButton(
                "Custom per day",
                customHours,
                () => setCustomHours(true),
                "hours-mode-custom"
              )}
            </View>
          </View>

          {!customHours ? (
            <>
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
              </View>

              <View style={{ gap: 6 }}>
                <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
                  Open days
                </ThemedText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {DAY_LABELS.map((label, i) => {
                    const day = i + 1;
                    const active = openDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => toggleDay(day)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={{
                          minWidth: 96,
                          flexGrow: 1,
                          backgroundColor: active ? primaryColor : colors.card,
                          borderWidth: 1,
                          borderColor: active ? primaryColor : borderColor,
                          borderRadius: 9,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
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
                  Tap a day to mark it open or closed.
                </ThemedText>
              </View>
            </>
          ) : (
            <View style={{ gap: 8 }}>
              {DAY_SHORT.map((label, i) => {
                const day = i + 1;
                const active = openDays.includes(day);
                const hours = weekHours[day];
                return (
                  <View
                    key={day}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      opacity: active ? 1 : 0.75,
                    }}
                  >
                    <Pressable
                      onPress={() => toggleDay(day)}
                      testID={`day-toggle-${day}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${DAY_LABELS[i]}: ${active ? "open" : "closed"}. Tap to toggle.`}
                      style={{
                        width: 58,
                        backgroundColor: active ? primaryColor : colors.card,
                        borderWidth: 1,
                        borderColor: active ? primaryColor : borderColor,
                        borderRadius: 8,
                        paddingVertical: 9,
                        alignItems: "center",
                      }}
                    >
                      <ThemedText
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: active ? "#fff" : mutedColor,
                        }}
                      >
                        {label}
                      </ThemedText>
                    </Pressable>

                    {active ? (
                      <>
                        <View style={{ flex: 1, minWidth: 96 }}>
                          <TimePicker
                            selectedTime={hours.open}
                            onSelect={(t) => setDayHours(day, { open: t })}
                            minTime="00:00"
                            maxTime="23:45"
                          />
                        </View>
                        <ThemedText style={{ fontSize: 12, color: mutedColor }}>–</ThemedText>
                        <View style={{ flex: 1, minWidth: 96 }}>
                          <TimePicker
                            selectedTime={hours.close}
                            onSelect={(t) => setDayHours(day, { close: t })}
                            minTime="00:00"
                            maxTime="23:45"
                          />
                        </View>
                        <Pressable
                          onPress={() => copyHoursToAllDays(day)}
                          testID={`copy-hours-${day}`}
                          accessibilityLabel={`Copy ${DAY_LABELS[i]}'s hours to every day`}
                          style={(state) => ({
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: (state as { hovered?: boolean }).hovered
                              ? primaryColor
                              : borderColor,
                            backgroundColor: colors.card,
                            alignItems: "center",
                            justifyContent: "center",
                          })}
                        >
                          <Ionicons name="copy-outline" size={14} color={mutedColor} />
                        </Pressable>
                      </>
                    ) : (
                      <ThemedText
                        style={{ flex: 1, fontSize: 12.5, color: mutedColor, fontStyle: "italic" }}
                      >
                        Closed
                      </ThemedText>
                    )}
                  </View>
                );
              })}
              <ThemedText style={{ fontSize: 11, color: mutedColor }}>
                Tap a day to mark it open or closed. Use{" "}
                <Ionicons name="copy-outline" size={11} color={mutedColor} /> to apply one day's
                hours to the whole week.
              </ThemedText>
            </View>
          )}

          {anyOvernight && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="moon-outline" size={12} color={mutedColor} />
              <ThemedText style={{ fontSize: 11, color: mutedColor }}>
                A closing time at or before opening means the restaurant closes after midnight.
              </ThemedText>
            </View>
          )}
        </View>

        {/* Reservations / walk-in policy */}
        <View
          style={{
            gap: 12,
            borderWidth: 1,
            borderColor,
            borderRadius: 12,
            padding: 14,
            backgroundColor: surface2,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <View style={{ gap: 2 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: "600" }}>Reservations</ThemedText>
              <ThemedText style={{ fontSize: 11, color: mutedColor }}>
                {walkInOnly
                  ? "Walk-ins only, online booking is off"
                  : walkInDays.length > 0
                    ? `Walk-ins only on ${walkInDays.length} ${walkInDays.length === 1 ? "day" : "days"}`
                    : "Online bookings on every open day"}
              </ThemedText>
            </View>
            <View
              style={{
                flexDirection: "row",
                gap: 2,
                padding: 3,
                borderRadius: 9,
                backgroundColor: isDark ? "#1b1d1f" : "#eef0f2",
              }}
            >
              {modeButton(
                "Online bookings",
                !walkInOnly,
                () => setWalkInOnly(false),
                "walkin-mode-bookings"
              )}
              {modeButton(
                "Walk-ins only",
                walkInOnly,
                () => setWalkInOnly(true),
                "walkin-mode-walkin"
              )}
            </View>
          </View>

          {walkInOnly ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="walk-outline" size={12} color={mutedColor} />
              <ThemedText style={{ fontSize: 11, color: mutedColor }}>
                The location stays listed publicly, but guests can't book online. They'll see a
                walk-in notice instead. Toggle back anytime; nothing is deleted or archived.
              </ThemedText>
            </View>
          ) : (
            <View style={{ gap: 6 }}>
              <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
                Walk-in only days
              </ThemedText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {DAY_SHORT.map((label, i) => {
                  const day = i + 1;
                  const active = walkInDays.includes(day);
                  const closed = !openDays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleWalkInDay(day)}
                      testID={`walkin-day-${day}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${DAY_LABELS[i]}: ${active ? "walk-ins only" : "online bookings"}. Tap to toggle.`}
                      style={{
                        minWidth: 96,
                        flexGrow: 1,
                        backgroundColor: active ? primaryColor : colors.card,
                        borderWidth: 1,
                        borderColor: active ? primaryColor : borderColor,
                        borderRadius: 9,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        alignItems: "center",
                        opacity: closed ? 0.55 : 1,
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
                Highlighted days stay open but only take walk-ins. The booking form is disabled for
                those dates. Dimmed days are currently marked closed.
              </ThemedText>
            </View>
          )}
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
            <ThemedText style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
              {saving ? "Saving…" : "Save changes"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
