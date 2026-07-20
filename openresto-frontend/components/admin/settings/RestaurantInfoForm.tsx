import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  DayHoursDto,
  RestaurantDto,
  deleteMenuFile,
  updateRestaurant,
  uploadMenuFile,
} from "@/api/restaurants";
import { getHoursForDay, hasCustomHours, parseOpenDays } from "@/utils/openingHours";
import { parseWalkInDays } from "@/utils/walkIn";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";
import { isOvernight } from "./sectionHelpers";
import { OpeningHoursSection } from "./OpeningHoursSection";
import { WalkInPolicySection } from "./WalkInPolicySection";
import { LocationTagsSection } from "./LocationTagsSection";
import { styles as sharedStyles } from "./settings.styles";

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

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

// Allowed start-time intervals — must match the server-side allow-list
// (RestaurantManagementService._allowedBookingSlotIntervalsMinutes). Kept small so
// availability slot generation can't be sent into a degenerate spin.
const SLOT_INTERVAL_OPTIONS = [15, 30, 60];

// Max spare-seats options for MaxTableOversizeSeats. null = "Off" (unrestricted); the cap
// rejects a table when (table.seats - partySize) exceeds the selected value.
const OVERSIZE_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

// Mirrors the backend MediaController._maxMenuBytes cap. A file picker pre-check keeps the
// UX instantaneous for oversize uploads instead of waiting on the server's 400 response.
const MAX_MENU_BYTES = 10 * 1024 * 1024;

// A MenuUrl pointing at this instance's own /media/menu-<id>.pdf path means it's a file
// the admin uploaded through OpenResto (vs. an external link they pasted). Used to decide
// which affordance to show: "Remove uploaded file" for served files, or the link input only.
const isServedMenuFile = (url: string | null | undefined): boolean =>
  !!url && /^\/media\/menu-\d+\.pdf(\?|$)/.test(url);

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

export function RestaurantInfoForm({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
}) {
  const { colors, isDark, primaryColor } = useAppTheme();

  const mutedColor = colors.muted;
  const borderColor = colors.border;
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [description, setDescription] = useState(restaurant.description ?? "");
  const [menuUrl, setMenuUrl] = useState(restaurant.menuUrl ?? "");
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
  const [bookingSlotIntervalMinutes, setBookingSlotIntervalMinutes] = useState(
    restaurant.bookingSlotIntervalMinutes ?? 30
  );
  const [maxTableOversizeSeats, setMaxTableOversizeSeats] = useState<number | null>(
    restaurant.maxTableOversizeSeats ?? null
  );
  const [tags, setTags] = useState<string[]>(restaurant.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuMsg, setMenuMsg] = useState<{ text: string; ok: boolean } | null>(null);
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

  const menuUrlIsServedFile = isServedMenuFile(restaurant.menuUrl);

  const handlePickMenu = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_MENU_BYTES) {
        setMenuMsg({ text: "Menu file must be under 10 MB.", ok: false });
        return;
      }
      setMenuUploading(true);
      setMenuMsg(null);
      const url = await uploadMenuFile(restaurant.id, file);
      setMenuUploading(false);
      if (url) {
        // A served file supersedes any typed link; clear it locally so the link input
        // doesn't read as stale text next to the newly-uploaded file indicator.
        setMenuUrl("");
        onSaved({ menuUrl: url });
        setMenuMsg({ text: "Menu uploaded.", ok: true });
      } else {
        setMenuMsg({ text: "Failed to upload menu.", ok: false });
      }
    };
    input.click();
  };

  const handleDeleteMenu = async () => {
    setMenuUploading(true);
    const ok = await deleteMenuFile(restaurant.id);
    setMenuUploading(false);
    if (ok) {
      onSaved({ menuUrl: null });
      setMenuMsg({ text: "Menu removed.", ok: true });
    } else {
      setMenuMsg({ text: "Failed to remove menu.", ok: false });
    }
  };

  const dirty =
    name !== restaurant.name ||
    address !== (restaurant.address ?? "") ||
    description !== (restaurant.description ?? "") ||
    menuUrl !== (restaurant.menuUrl ?? "") ||
    hoursDirty ||
    openDays.join(",") !== parseOpenDays(restaurant.openDays).join(",") ||
    walkInOnly !== !!restaurant.walkInOnly ||
    walkInDays.join(",") !== parseWalkInDays(restaurant.walkInDays).join(",") ||
    timezone !== (restaurant.timezone ?? "UTC") ||
    defaultBookingDurationMinutes !== (restaurant.defaultBookingDurationMinutes ?? 60) ||
    bookingSlotIntervalMinutes !== (restaurant.bookingSlotIntervalMinutes ?? 30) ||
    maxTableOversizeSeats !== (restaurant.maxTableOversizeSeats ?? null) ||
    tags.join(",") !== (restaurant.tags ?? []).join(",");

  const discard = () => {
    setName(restaurant.name);
    setAddress(restaurant.address ?? "");
    setDescription(restaurant.description ?? "");
    setMenuUrl(restaurant.menuUrl ?? "");
    setOpenTime(restaurant.openTime ?? "09:00");
    setCloseTime(restaurant.closeTime ?? "22:00");
    setCustomHours(hasCustomHours(restaurant));
    setWeekHours(initialWeekHours(restaurant));
    setOpenDays(parseOpenDays(restaurant.openDays));
    setWalkInOnly(!!restaurant.walkInOnly);
    setWalkInDays(parseWalkInDays(restaurant.walkInDays));
    setTimezone(restaurant.timezone ?? "UTC");
    setDefaultBookingDurationMinutes(restaurant.defaultBookingDurationMinutes ?? 60);
    setBookingSlotIntervalMinutes(restaurant.bookingSlotIntervalMinutes ?? 30);
    setMaxTableOversizeSeats(restaurant.maxTableOversizeSeats ?? null);
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
      description: description.trim() || null,
      menuUrl: menuUrl.trim() || null,
      openTime: customHours ? undefined : openTime,
      closeTime: customHours ? undefined : closeTime,
      openHours: openHoursPayload,
      openDays: openDays.join(","),
      walkInOnly,
      walkInDays: walkInDays.join(","),
      timezone,
      defaultBookingDurationMinutes,
      bookingSlotIntervalMinutes,
      maxTableOversizeSeats,
      tags: finalTags.join(","),
    });
    setSaving(false);
    if (result) {
      onSaved({
        name: result.name,
        address: result.address,
        description: result.description,
        menuUrl: result.menuUrl,
        openTime: result.openTime,
        closeTime: result.closeTime,
        openHours: result.openHours,
        openDays: result.openDays,
        walkInOnly: result.walkInOnly,
        walkInDays: result.walkInDays,
        timezone: result.timezone,
        defaultBookingDurationMinutes: result.defaultBookingDurationMinutes,
        bookingSlotIntervalMinutes: result.bookingSlotIntervalMinutes,
        maxTableOversizeSeats: result.maxTableOversizeSeats,
        tags: result.tags,
      });
    }
  };

  const anyOvernight = customHours
    ? openDays.some((d) => isOvernight(weekHours[d].open, weekHours[d].close))
    : isOvernight(openTime, closeTime);

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
          <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
            Restaurant name
          </ThemedText>
          <Input value={name} onChangeText={setName} placeholder="Restaurant name" />
        </View>

        <View style={{ gap: 6 }}>
          <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>Address</ThemedText>
          <Input value={address} onChangeText={setAddress} placeholder="e.g. 123 Main St" />
        </View>

        <View style={{ gap: 6 }}>
          <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
            Description (optional)
          </ThemedText>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Short blurb shown on the location page. Supports links like [menu](https://example.com)."
            multiline
            numberOfLines={4}
            style={{ height: 96, paddingTop: 10, paddingBottom: 10 }}
          />
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            Shown on the public location page. Use [label](https://url) for links.
          </ThemedText>
        </View>

        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>Menu</ThemedText>
            <ThemedText
              style={{
                fontSize: 10,
                fontWeight: "600",
                textTransform: "uppercase" as const,
                letterSpacing: 1,
                color: mutedColor,
              }}
            >
              optional
            </ThemedText>
          </View>
          {menuUrlIsServedFile ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor,
                borderRadius: 10,
                backgroundColor: surface2,
              }}
            >
              <Ionicons name="document-text-outline" size={18} color={primaryColor} />
              <ThemedText style={{ fontSize: 13, flex: 1 }} numberOfLines={1}>
                Uploaded menu PDF
              </ThemedText>
              <Pressable
                style={[sharedStyles.secBtn, { borderColor, opacity: menuUploading ? 0.5 : 1 }]}
                onPress={handleDeleteMenu}
                disabled={menuUploading}
              >
                <ThemedText style={[sharedStyles.secBtnText, { color: theme.colors.error }]}>
                  {menuUploading ? "Removing…" : "Remove file"}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <Input
              value={menuUrl}
              onChangeText={setMenuUrl}
              placeholder="https://your-menu-url.com/menu.pdf"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          )}
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!menuUrlIsServedFile && (
              <Pressable
                style={[sharedStyles.secBtn, { borderColor, opacity: menuUploading ? 0.5 : 1 }]}
                onPress={handlePickMenu}
                disabled={menuUploading}
              >
                <ThemedText style={[sharedStyles.secBtnText, { color: primaryColor }]}>
                  {menuUploading ? "Uploading…" : "Upload PDF"}
                </ThemedText>
              </Pressable>
            )}
            {menuMsg && (
              <ThemedText
                style={{
                  fontSize: 12,
                  color: menuMsg.ok ? theme.colors.success : theme.colors.error,
                }}
              >
                {menuMsg.text}
              </ThemedText>
            )}
          </View>
          <ThemedText style={{ fontSize: 11, color: mutedColor }}>
            Upload a PDF (max 10 MB) or paste a link to your menu. Shown as a &quot;View menu&quot;
            button on the location page.
          </ThemedText>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
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
            <ThemedText style={{ fontSize: 11, color: mutedColor }}>
              If this value differs from the customer's device timezone, a note will appear on the
              booking page.
            </ThemedText>
          </View>
          <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
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
          <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
              Booking start-time interval
            </ThemedText>
            <select
              data-testid="booking-slot-interval-select"
              value={bookingSlotIntervalMinutes}
              onChange={
                /* istanbul ignore next */ (e) =>
                  setBookingSlotIntervalMinutes(Number(e.target.value))
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
              {SLOT_INTERVAL_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDurationLabel(minutes)}
                </option>
              ))}
            </select>
            <ThemedText style={{ fontSize: 11, color: mutedColor }}>
              How far apart selectable start times are (independent of booking duration)
            </ThemedText>
          </View>
          <View style={{ flex: 1, minWidth: 220, gap: 6 }}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
              Max table oversize
            </ThemedText>
            <select
              data-testid="max-table-oversize-select"
              value={maxTableOversizeSeats ?? ""}
              onChange={
                /* istanbul ignore next */ (e) =>
                  setMaxTableOversizeSeats(e.target.value === "" ? null : Number(e.target.value))
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
              <option value="">Off</option>
              {OVERSIZE_OPTIONS.map((seats) => (
                <option key={seats} value={seats}>
                  +{seats} seat{seats === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <ThemedText style={{ fontSize: 11, color: mutedColor }}>
              Don&apos;t offer tables more than this many seats larger than the party size
            </ThemedText>
          </View>
        </View>

        {/* Opening hours (decomposed into <OpeningHoursSection/>) */}
        <OpeningHoursSection
          customHours={customHours}
          openTime={openTime}
          closeTime={closeTime}
          weekHours={weekHours}
          openDays={openDays}
          anyOvernight={anyOvernight}
          onSetCustomHours={setCustomHours}
          onSetOpenTime={setOpenTime}
          onSetCloseTime={setCloseTime}
          onSetDayHours={setDayHours}
          onCopyHoursToAllDays={copyHoursToAllDays}
          onToggleDay={toggleDay}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
          cardBg={colors.card}
          textColor={colors.text}
          surface2={surface2}
          isDark={isDark}
        />

        {/* Reservations / walk-in policy (decomposed into <WalkInPolicySection/>) */}
        <WalkInPolicySection
          walkInOnly={walkInOnly}
          walkInDays={walkInDays}
          openDays={openDays}
          onSetWalkInOnly={setWalkInOnly}
          onToggleWalkInDay={toggleWalkInDay}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
          cardBg={colors.card}
          textColor={colors.text}
          surface2={surface2}
          isDark={isDark}
        />

        {/* Location tags (decomposed into <LocationTagsSection/>) */}
        <LocationTagsSection
          tags={tags}
          tagInput={tagInput}
          onSetTagInput={setTagInput}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
          surface2={surface2}
        />
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
