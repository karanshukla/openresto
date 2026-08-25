import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAutosave } from "@/hooks/use-autosave";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { AccordionCardHeader } from "./AccordionCardHeader";
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
import { styles as sharedStyles } from "./settings.styles";
import Select, { type SelectOption } from "@/components/common/Select";
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

const TIMEZONE_OPTIONS: SelectOption[] = TIMEZONES.map((tz) => ({
  value: tz,
  label: tz.replace(/_/g, " "),
}));

const DURATION_OPTIONS: SelectOption[] = [30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480].map(
  (minutes) => ({ value: minutes, label: formatDurationLabel(minutes) })
);

// Allowed start-time intervals — must match the server-side allow-list
// (RestaurantManagementService._allowedBookingSlotIntervalsMinutes). Kept small so
// availability slot generation can't be sent into a degenerate spin.
const SLOT_INTERVAL_OPTIONS: SelectOption[] = [15, 30, 60].map((minutes) => ({
  value: minutes,
  label: formatDurationLabel(minutes),
}));

// Max spare-seats options for MaxTableOversizeSeats. The API models "unrestricted" as null,
// which a Select option value can't hold, so it travels through the picker as this sentinel.
// The cap rejects a table when (table.seats - partySize) exceeds the selection.
const OVERSIZE_OFF = "off";

/**
 * `value` is the `MaxTableOversizeSeats` wire value (or the `OVERSIZE_OFF` sentinel for the
 * server's null) — only `label` localizes.
 * @see [RestaurantInfoForm.test.tsx](../../../tests/components/admin/settings/RestaurantInfoForm.test.tsx)
 * — pins the singular "+1 seat" against the plural "+2 seats".
 */
function getOversizeOptions(t: TFunction): SelectOption[] {
  return [
    { value: OVERSIZE_OFF, label: t("admin.settings.restaurantInfo.oversizeOff") },
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((seats) => ({
      value: seats,
      label: t("admin.settings.restaurantInfo.oversizeSeats", { count: seats }),
    })),
  ];
}

// Booking reference formats — values must match the backend BookingRefFormat member names,
// which is what the API accepts and returns.
function getBookingRefFormatOptions(t: TFunction): { value: BookingRefFormat; label: string }[] {
  return [
    { value: "AlphaNumeric", label: t("admin.settings.restaurantInfo.refFormatWords") },
    { value: "Numeric", label: t("admin.settings.restaurantInfo.refFormatNumbers") },
  ];
}

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

/**
 * What changing a location's timezone does to the bookings it already holds.
 *
 * Every sitting is stored in UTC, so the booking does not move: the guest is still expected at
 * the same real moment. What moves is the wall-clock time that moment reads as, which is the
 * time the confirmation email told them. Nothing re-sends, and the schedule-conflict read does
 * not catch it either, because the sitting usually still lands inside the new local window.
 *
 * Deliberately a warning and not a gate or a rebase. Silently rewriting confirmed bookings as a
 * side effect of a settings edit is the failure mode this whole area exists to avoid.
 *
 * @see [RestaurantInfoForm.test.tsx](../../../tests/components/admin/settings/RestaurantInfoForm.test.tsx)
 * — pins that it stays out of the way until the location actually holds bookings.
 */
function TimezoneRebaseWarning({
  upcomingBookingsCount,
  warningColor,
}: {
  upcomingBookingsCount: number;
  warningColor: string;
}) {
  const { t } = useTranslation();
  if (upcomingBookingsCount <= 0) return null;

  return (
    <View testID="timezone-rebase-warning" style={styles.fieldWarning}>
      <Icon name="alert-circle-outline" size="sm" color={warningColor} />
      <ThemedText style={[styles.fieldHint, styles.fieldWarningText, { color: warningColor }]}>
        {t("admin.settings.restaurantInfo.timezoneRebaseWarning", {
          bookings: t("admin.settings.restaurantInfo.upcomingBookingsCount", {
            count: upcomingBookingsCount,
          }),
        })}
      </ThemedText>
    </View>
  );
}

export function RestaurantInfoForm({
  restaurant,
  onSaved,
  /**
   * Drives the timezone warning only. Zero means there is nothing a timezone change could
   * reinterpret, so the warning stays out of the way on a location with no bookings yet.
   */
  upcomingBookingsCount = 0,
}: {
  restaurant: RestaurantDto;
  onSaved: (patch: Partial<RestaurantDto>) => void;
  upcomingBookingsCount?: number;
}) {
  const { t } = useTranslation();
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
        setMenuMsg({ text: t("admin.settings.restaurantInfo.menuTooLarge"), ok: false });
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
        setMenuMsg({ text: t("admin.settings.restaurantInfo.menuUploaded"), ok: true });
      } else {
        setMenuMsg({ text: t("admin.settings.restaurantInfo.menuUploadFailed"), ok: false });
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
      setMenuMsg({ text: t("admin.settings.restaurantInfo.menuRemoved"), ok: true });
    } else {
      setMenuMsg({ text: t("admin.settings.restaurantInfo.menuRemoveFailed"), ok: false });
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
    if (!name.trim()) return t("admin.settings.restaurantInfo.blockedNoName");
    const trimmedMenuUrl = menuUrl.trim();
    if (
      trimmedMenuUrl &&
      !isServedMenuFile(trimmedMenuUrl) &&
      !isValidUrl(trimmedMenuUrl, WEB_SCHEMES)
    ) {
      return t("admin.settings.restaurantInfo.blockedInvalidMenuUrl");
    }
    if (phoneNumber.trim().length > MAX_PHONE_LENGTH) {
      return t("admin.settings.restaurantInfo.blockedPhoneTooLong", { max: MAX_PHONE_LENGTH });
    }
    if (emailAddress.trim() && !isValidEmail(emailAddress.trim())) {
      return t("admin.settings.restaurantInfo.blockedInvalidEmail");
    }
    return null;
  })();

  const { status, error, retry, undo } = useAutosave({
    values,
    saved,
    canSave: !blockedReason,
    save: async (payload) => {
      const result = await updateRestaurant(restaurant.id, payload);
      if (!result) return t("admin.settings.restaurantInfo.saveUnreachable");
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

  const [basicInfoExpanded, setBasicInfoExpanded] = usePersistedState(
    "locations:basicInfo:expanded",
    true
  );
  const [menuExpanded, setMenuExpanded] = usePersistedState("locations:menu:expanded", true);
  const [contactExpanded, setContactExpanded] = usePersistedState(
    "locations:contact:expanded",
    true
  );
  const [bookingExpanded, setBookingExpanded] = usePersistedState(
    "locations:booking:expanded",
    true
  );

  const basicInfoSubtitle = [
    name.trim() || t("admin.settings.restaurantInfo.untitledLocation"),
    address.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const menuSubtitle = menuUrlIsServedFile
    ? t("admin.settings.restaurantInfo.menuPdfUploaded")
    : menuUrl.trim()
      ? t("admin.settings.restaurantInfo.menuLinkSet")
      : t("admin.settings.restaurantInfo.menuNotSet");
  const contactSubtitle =
    [phoneNumber.trim(), emailAddress.trim()].filter(Boolean).join(" · ") ||
    t("admin.settings.restaurantInfo.contactUsesBrandWide");
  const bookingSubtitle = t("admin.settings.restaurantInfo.bookingSubtitle", {
    timezone: timezone.replace(/_/g, " "),
    duration: formatDurationLabel(defaultBookingDurationMinutes),
  });

  return (
    <>
      <View style={[sharedStyles.secCard, { backgroundColor: colors.card, borderColor }]}>
        <AccordionCardHeader
          icon="storefront-outline"
          title={t("admin.settings.restaurantInfo.basicInfoTitle")}
          subtitle={basicInfoSubtitle}
          expanded={basicInfoExpanded}
          onToggle={() => setBasicInfoExpanded((v) => !v)}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
        />
        <AnimatedAccordion expanded={basicInfoExpanded}>
          <View style={[sharedStyles.secForm, { borderTopColor: borderColor }]}>
            <View style={styles.field}>
              <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                {t("admin.settings.restaurantInfo.nameLabel")}
              </ThemedText>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t("admin.settings.restaurantInfo.namePlaceholder")}
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                {t("admin.settings.restaurantInfo.addressLabel")}
              </ThemedText>
              <Input
                value={address}
                onChangeText={setAddress}
                placeholder={t("admin.settings.restaurantInfo.addressPlaceholder")}
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                {t("admin.settings.restaurantInfo.descriptionLabel")}
              </ThemedText>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder={t("admin.settings.restaurantInfo.descriptionPlaceholder")}
                multiline
                numberOfLines={4}
                style={styles.descriptionInput}
              />
              <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
                {t("admin.settings.restaurantInfo.descriptionHint")}
              </ThemedText>
            </View>
          </View>
        </AnimatedAccordion>
      </View>

      <View style={[sharedStyles.secCard, { backgroundColor: colors.card, borderColor }]}>
        <AccordionCardHeader
          icon="document-text-outline"
          title={t("admin.settings.restaurantInfo.menuTitle")}
          subtitle={menuSubtitle}
          expanded={menuExpanded}
          onToggle={() => setMenuExpanded((v) => !v)}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
        />
        <AnimatedAccordion expanded={menuExpanded}>
          <View style={[sharedStyles.secForm, { borderTopColor: borderColor }]}>
            {menuUrlIsServedFile ? (
              <View style={[styles.menuFileRow, { borderColor, backgroundColor: surface2 }]}>
                <Icon name="document-text-outline" size="lg" color={primaryColor} />
                <ThemedText style={styles.menuFileName} numberOfLines={1}>
                  {t("admin.settings.restaurantInfo.uploadedMenuPdf")}
                </ThemedText>
                <Button
                  variant="secondary"
                  tone="danger"
                  size="md"
                  icon="trash-outline"
                  onPress={handleDeleteMenu}
                  disabled={menuUploading}
                  loading={menuUploading}
                  accessibilityLabel={t("admin.settings.restaurantInfo.removeMenuPdfLabel")}
                >
                  {menuUploading
                    ? t("admin.settings.restaurantInfo.removing")
                    : t("admin.settings.restaurantInfo.removeFile")}
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
                  accessibilityLabel={t("admin.settings.restaurantInfo.uploadMenuPdfLabel")}
                >
                  {menuUploading
                    ? t("admin.settings.restaurantInfo.uploading")
                    : t("admin.settings.restaurantInfo.uploadPdf")}
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
              {t("admin.settings.restaurantInfo.menuHint")}
            </ThemedText>
          </View>
        </AnimatedAccordion>
      </View>

      <View style={[sharedStyles.secCard, { backgroundColor: colors.card, borderColor }]}>
        <AccordionCardHeader
          icon="call-outline"
          title={t("admin.settings.restaurantInfo.contactTitle")}
          subtitle={contactSubtitle}
          expanded={contactExpanded}
          onToggle={() => setContactExpanded((v) => !v)}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
        />
        <AnimatedAccordion expanded={contactExpanded}>
          <View style={[sharedStyles.secForm, { borderTopColor: borderColor }]}>
            <View style={styles.fieldGrid}>
              <View style={styles.gridField}>
                <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.phoneLabel")}
                </ThemedText>
                <Input
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder={t("admin.settings.restaurantInfo.phonePlaceholder")}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="phone-pad"
                  maxLength={MAX_PHONE_LENGTH}
                />
              </View>
              <View style={styles.gridField}>
                <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.emailLabel")}
                </ThemedText>
                <Input
                  value={emailAddress}
                  onChangeText={setEmailAddress}
                  placeholder={t("admin.settings.restaurantInfo.emailPlaceholder")}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  maxLength={MAX_EMAIL_LENGTH}
                />
              </View>
            </View>
            <ThemedText style={[styles.contactHint, { color: mutedColor }]}>
              {t("admin.settings.restaurantInfo.contactHint")}
            </ThemedText>
          </View>
        </AnimatedAccordion>
      </View>

      <View style={[sharedStyles.secCard, { backgroundColor: colors.card, borderColor }]}>
        <AccordionCardHeader
          icon="options-outline"
          title={t("admin.settings.restaurantInfo.bookingSettingsTitle")}
          subtitle={bookingSubtitle}
          expanded={bookingExpanded}
          onToggle={() => setBookingExpanded((v) => !v)}
          primaryColor={primaryColor}
          mutedColor={mutedColor}
        />
        <AnimatedAccordion expanded={bookingExpanded}>
          <View style={[sharedStyles.secForm, { borderTopColor: borderColor }]}>
            <View style={styles.fieldGrid}>
              <View style={styles.gridField}>
                <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.timezoneLabel")}
                </ThemedText>
                <Select
                  accessibilityLabel={t("admin.settings.restaurantInfo.timezoneLabel")}
                  options={TIMEZONE_OPTIONS}
                  selectedValue={timezone}
                  onSelect={(value) => setTimezone(String(value))}
                />
                <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.timezoneHint")}
                </ThemedText>
                <TimezoneRebaseWarning
                  upcomingBookingsCount={upcomingBookingsCount}
                  warningColor={colors.warning}
                />
              </View>
              <View style={styles.gridField}>
                <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.durationLabel")}
                </ThemedText>
                <Select
                  accessibilityLabel={t("admin.settings.restaurantInfo.durationLabel")}
                  options={DURATION_OPTIONS}
                  selectedValue={defaultBookingDurationMinutes}
                  onSelect={(value) => setDefaultBookingDurationMinutes(Number(value))}
                />
                <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.durationHint")}
                </ThemedText>
              </View>
              <View style={styles.gridField}>
                <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.slotIntervalLabel")}
                </ThemedText>
                <Select
                  accessibilityLabel={t("admin.settings.restaurantInfo.slotIntervalLabel")}
                  options={SLOT_INTERVAL_OPTIONS}
                  selectedValue={bookingSlotIntervalMinutes}
                  onSelect={(value) => setBookingSlotIntervalMinutes(Number(value))}
                />
                <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.slotIntervalHint")}
                </ThemedText>
              </View>
              <View style={styles.gridField}>
                <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.oversizeLabel")}
                </ThemedText>
                <Select
                  accessibilityLabel={t("admin.settings.restaurantInfo.oversizeLabel")}
                  options={getOversizeOptions(t)}
                  selectedValue={maxTableOversizeSeats ?? OVERSIZE_OFF}
                  onSelect={(value) =>
                    setMaxTableOversizeSeats(value === OVERSIZE_OFF ? null : Number(value))
                  }
                />
                <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.oversizeHint")}
                </ThemedText>
              </View>
              <View style={styles.gridField}>
                <ThemedText style={[sharedStyles.fieldLabel, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.refFormatLabel")}
                </ThemedText>
                <Select
                  accessibilityLabel={t("admin.settings.restaurantInfo.refFormatLabel")}
                  options={getBookingRefFormatOptions(t)}
                  selectedValue={bookingRefFormat}
                  onSelect={(value) => setBookingRefFormat(value as BookingRefFormat)}
                />
                <ThemedText style={[styles.fieldHint, { color: mutedColor }]}>
                  {t("admin.settings.restaurantInfo.refFormatHint")}
                </ThemedText>
              </View>
            </View>
          </View>
        </AnimatedAccordion>
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
        primaryColor={primaryColor}
        cardBg={colors.card}
        surface2={surface2}
      />

      <View style={[styles.statusBar, { backgroundColor: colors.page }]}>
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
    </>
  );
}
