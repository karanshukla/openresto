import { useState } from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { SaveStatus } from "./SaveStatus";
import {
  BookingRefFormat,
  DayHoursDto,
  RestaurantDto,
  deleteMenuFile,
  updateRestaurant,
  uploadMenuFile,
} from "@/api/restaurants";
import { getHoursForDay, hasCustomHours, parseOpenDays } from "@/utils/openingHours";
import { isValidEmail, isValidUrl, WEB_SCHEMES } from "@/utils/validation";
import { parseWalkInDays } from "@/utils/walkIn";
import { theme } from "@/theme/theme";
import { isOvernight } from "./sectionHelpers";
import { OpeningHoursSection } from "./OpeningHoursSection";
import { WalkInPolicySection } from "./WalkInPolicySection";
import { LocationTagsSection } from "./LocationTagsSection";
import { styles as sharedStyles, domStyles, themedSelect } from "./settings.styles";
import { styles } from "./RestaurantInfoForm.styles";
import { Icon } from "@/components/common/Icon";

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

// Booking reference formats — values must match the backend BookingRefFormat member names,
// which is what the API accepts and returns.
const BOOKING_REF_FORMAT_OPTIONS: { value: BookingRefFormat; label: string }[] = [
  { value: "AlphaNumeric", label: "Words (crispy-basil-saffron)" },
  { value: "Numeric", label: "Numbers (48273910)" },
];

// Mirrors the backend ContactLimits caps so the admin sees the ceiling before the round-trip.
const MAX_PHONE_LENGTH = 32;
const MAX_EMAIL_LENGTH = 254;

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
  const [phoneNumber, setPhoneNumber] = useState(restaurant.phoneNumber ?? "");
  const [emailAddress, setEmailAddress] = useState(restaurant.emailAddress ?? "");
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
  const [bookingRefFormat, setBookingRefFormat] = useState<BookingRefFormat>(
    restaurant.bookingRefFormat ?? "AlphaNumeric"
  );
  const [tags, setTags] = useState<string[]>(restaurant.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuMsg, setMenuMsg] = useState<{ text: string; ok: boolean } | null>(null);

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

  // The payload as it would be sent right now, and what the server already holds. The autosave
  // hook compares the two, so a change anywhere in this form is a change to `values`.
  const values = {
    name: name.trim(),
    address: address.trim() || null,
    // Blank must go over the wire as "" — the backend's PATCH convention reads null as
    // "leave untouched", so sending null here made clearing an existing blurb a no-op.
    description: description.trim(),
    // Same "" clears / null leaves untouched convention as description, with one carve-out:
    // while a served file is the stored menu the text input isn't rendered and the local
    // menuUrl is deliberately blank (the upload flow clears it), so null keeps this save from
    // wiping the file. Otherwise blank must reach the server as "" to clear a pasted link.
    menuUrl: menuUrlIsServedFile ? null : menuUrl.trim(),
    phoneNumber: phoneNumber.trim(),
    emailAddress: emailAddress.trim(),
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
    bookingRefFormat,
    tags: tags.join(","),
  };

  const saved = {
    name: restaurant.name,
    address: restaurant.address ?? null,
    description: restaurant.description ?? "",
    menuUrl: menuUrlIsServedFile ? null : (restaurant.menuUrl ?? ""),
    phoneNumber: restaurant.phoneNumber ?? "",
    emailAddress: restaurant.emailAddress ?? "",
    openTime: customHours ? undefined : (restaurant.openTime ?? "09:00"),
    closeTime: customHours ? undefined : (restaurant.closeTime ?? "22:00"),
    openHours: initialOpenHours,
    openDays: parseOpenDays(restaurant.openDays).join(","),
    walkInOnly: !!restaurant.walkInOnly,
    walkInDays: parseWalkInDays(restaurant.walkInDays).join(","),
    timezone: restaurant.timezone ?? "UTC",
    defaultBookingDurationMinutes: restaurant.defaultBookingDurationMinutes ?? 60,
    bookingSlotIntervalMinutes: restaurant.bookingSlotIntervalMinutes ?? 30,
    maxTableOversizeSeats: restaurant.maxTableOversizeSeats ?? null,
    bookingRefFormat: restaurant.bookingRefFormat ?? "AlphaNumeric",
    tags: (restaurant.tags ?? []).join(","),
  };

  /**
   * Why the save is paused, or null when it can go. These mirror the backend's own validators
   * (UrlValidator, ContactFields): with no Save button to disable there is nothing to grey out,
   * so the reason is stated in the footer instead of the write being silently withheld.
   */
  const blockedReason = ((): string | null => {
    if (!name.trim()) return "Add a name to save.";
    const trimmedMenuUrl = menuUrl.trim();
    if (
      trimmedMenuUrl &&
      !isServedMenuFile(trimmedMenuUrl) &&
      !isValidUrl(trimmedMenuUrl, WEB_SCHEMES)
    ) {
      return "Menu URL must be a valid http(s) link.";
    }
    if (phoneNumber.trim().length > MAX_PHONE_LENGTH) {
      return `Phone number cannot exceed ${MAX_PHONE_LENGTH} characters.`;
    }
    if (emailAddress.trim() && !isValidEmail(emailAddress.trim())) {
      return "Contact email must be a valid email address.";
    }
    return null;
  })();

  const { status, error, retry, undo } = useAutosave({
    values,
    saved,
    canSave: !blockedReason,
    save: async (payload) => {
      const result = await updateRestaurant(restaurant.id, payload);
      if (!result) return "Couldn't reach the server.";
      onSaved({
        name: result.name,
        address: result.address,
        description: result.description,
        menuUrl: result.menuUrl,
        phoneNumber: result.phoneNumber,
        emailAddress: result.emailAddress,
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
        bookingRefFormat: result.bookingRefFormat,
        tags: result.tags,
      });
      return null;
    },
    // The payload is derived from this form's state rather than mirroring it (days and tags are
    // joined into strings, hours into a 7-entry list), so putting one back means running that
    // derivation backwards. Anything the payload doesn't carry is left alone.
    onRestore: (previous) => {
      setName(previous.name);
      setAddress(previous.address ?? "");
      setDescription(previous.description);
      if (!menuUrlIsServedFile) setMenuUrl(previous.menuUrl ?? "");
      setPhoneNumber(previous.phoneNumber);
      setEmailAddress(previous.emailAddress);
      setOpenDays(previous.openDays ? previous.openDays.split(",").map(Number) : []);
      setWalkInOnly(previous.walkInOnly);
      setWalkInDays(previous.walkInDays ? previous.walkInDays.split(",").map(Number) : []);
      setTimezone(previous.timezone);
      setDefaultBookingDurationMinutes(previous.defaultBookingDurationMinutes);
      setBookingSlotIntervalMinutes(previous.bookingSlotIntervalMinutes);
      setMaxTableOversizeSeats(previous.maxTableOversizeSeats);
      setBookingRefFormat(previous.bookingRefFormat);
      setTags(previous.tags ? previous.tags.split(",") : []);
      const restored: WeekHours = {};
      for (const entry of previous.openHours) {
        restored[entry.day] = { open: entry.open, close: entry.close };
      }
      setWeekHours(restored);
      const uniform = previous.openHours.every(
        (h) => h.open === previous.openHours[0].open && h.close === previous.openHours[0].close
      );
      setCustomHours(!uniform);
      if (uniform && previous.openHours[0]) {
        setOpenTime(previous.openHours[0].open);
        setCloseTime(previous.openHours[0].close);
      }
    },
  });

  const anyOvernight = customHours
    ? openDays.some((d) => isOvernight(weekHours[d].open, weekHours[d].close))
    : isOvernight(openTime, closeTime);

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.headerTitle}>Restaurant info</ThemedText>
          <ThemedText style={[styles.headerSub, { color: mutedColor }]}>
            Name, address, hours and timezone for this location.
          </ThemedText>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.field}>
          <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
            Restaurant name
          </ThemedText>
          <Input value={name} onChangeText={setName} placeholder="Restaurant name" />
        </View>

        <View style={styles.field}>
          <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>Address</ThemedText>
          <Input value={address} onChangeText={setAddress} placeholder="e.g. 123 Main St" />
        </View>

        <View style={styles.field}>
          <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
            Description (optional)
          </ThemedText>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Short blurb shown on the location page. Supports links like [menu](https://example.com)."
            multiline
            numberOfLines={4}
            style={styles.descriptionInput}
          />
          <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
            Shown on the public location page. Use [label](https://url) for links.
          </ThemedText>
        </View>

        <View style={styles.field}>
          <View style={styles.menuLabelRow}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
              Menu (optional)
            </ThemedText>
          </View>
          {menuUrlIsServedFile ? (
            <View style={[styles.menuFileRow, { borderColor, backgroundColor: surface2 }]}>
              <Icon name="document-text-outline" size="lg" color={primaryColor} />
              <ThemedText style={styles.menuFileName} numberOfLines={1}>
                Uploaded menu PDF
              </ThemedText>
              <Button
                variant="secondary"
                tone="danger"
                size="md"
                icon="trash-outline"
                onPress={handleDeleteMenu}
                disabled={menuUploading}
                loading={menuUploading}
                accessibilityLabel="Remove the uploaded menu PDF"
              >
                {menuUploading ? "Removing…" : "Remove file"}
              </Button>
            </View>
          ) : (
            <Input
              value={menuUrl}
              onChangeText={(v) => {
                setMenuUrl(v);
                if (menuMsg && !menuMsg.ok) setMenuMsg(null);
              }}
              placeholder="https://your-menu-url.com/menu.pdf"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          )}
          <View style={styles.menuActions}>
            {!menuUrlIsServedFile && (
              <Button
                variant="secondary"
                size="md"
                icon="cloud-upload-outline"
                onPress={handlePickMenu}
                disabled={menuUploading}
                loading={menuUploading}
                accessibilityLabel="Upload a menu PDF"
              >
                {menuUploading ? "Uploading…" : "Upload PDF"}
              </Button>
            )}
            {menuMsg && (
              <ThemedText
                style={[
                  styles.menuMsg,
                  { color: menuMsg.ok ? theme.colors.success : theme.colors.error },
                ]}
              >
                {menuMsg.text}
              </ThemedText>
            )}
          </View>
          <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
            Upload a PDF (max 10 MB) or paste a link to your menu. Shown as a &quot;View menu&quot;
            button on the location page.
          </ThemedText>
        </View>

        <View style={styles.fieldGrid}>
          <View style={styles.gridField}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
              Contact phone (optional)
            </ThemedText>
            <Input
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="e.g. +44 20 7946 0958"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="phone-pad"
              maxLength={MAX_PHONE_LENGTH}
            />
          </View>
          <View style={styles.gridField}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
              Contact email (optional)
            </ThemedText>
            <Input
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="e.g. bookings@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              maxLength={MAX_EMAIL_LENGTH}
            />
          </View>
        </View>
        <ThemedText style={[styles.contactHint, { color: mutedColor }]}>
          Shown to diners who need to arrange a booking directly (e.g. a large party). Leave blank
          to use the brand-wide contact details from Settings.
        </ThemedText>

        <View style={styles.fieldGrid}>
          <View style={styles.gridField}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
              Timezone
            </ThemedText>
            <select
              value={timezone}
              onChange={/* istanbul ignore next */ (e) => setTimezone(e.target.value)}
              style={{ ...domStyles.select, ...themedSelect(colors) }}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
              If this value differs from the customer's device timezone, a note will appear on the
              booking page.
            </ThemedText>
          </View>
          <View style={styles.gridField}>
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
              style={{ ...domStyles.select, ...themedSelect(colors) }}
            >
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDurationLabel(minutes)}
                </option>
              ))}
            </select>
            <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
              How long each new booking occupies a table by default
            </ThemedText>
          </View>
          <View style={styles.gridField}>
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
              style={{ ...domStyles.select, ...themedSelect(colors) }}
            >
              {SLOT_INTERVAL_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDurationLabel(minutes)}
                </option>
              ))}
            </select>
            <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
              How far apart selectable start times are (independent of booking duration)
            </ThemedText>
          </View>
          <View style={styles.gridField}>
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
              style={{ ...domStyles.select, ...themedSelect(colors) }}
            >
              <option value="">Off</option>
              {OVERSIZE_OPTIONS.map((seats) => (
                <option key={seats} value={seats}>
                  +{seats} seat{seats === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
              Don&apos;t offer tables more than this many seats larger than the party size
            </ThemedText>
          </View>
          <View style={styles.gridField}>
            <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
              Booking reference format
            </ThemedText>
            <select
              data-testid="booking-ref-format-select"
              value={bookingRefFormat}
              onChange={
                /* istanbul ignore next */ (e) =>
                  setBookingRefFormat(e.target.value as BookingRefFormat)
              }
              style={{ ...domStyles.select, ...themedSelect(colors) }}
            >
              {BOOKING_REF_FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
              What new booking references look like. Existing bookings keep theirs.
            </ThemedText>
          </View>
        </View>

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

        <LocationTagsSection
          tags={tags}
          tagInput={tagInput}
          onSetTagInput={setTagInput}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          borderColor={borderColor}
          mutedColor={mutedColor}
          surface2={surface2}
        />
      </View>

      <View style={[styles.divider, { borderColor }]} />

      <View style={styles.footer}>
        <SaveStatus
          status={status}
          error={error}
          onRetry={retry}
          onUndo={undo}
          mutedColor={mutedColor}
          blockedReason={blockedReason}
          testID="location-save-status"
        />
      </View>
    </View>
  );
}
