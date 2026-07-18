import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { RestaurantDto } from "@/api/restaurants";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";
import { getHoursForDay, hasCustomHours } from "@/utils/openingHours";
import { isWalkInOnlyOnDay, walkInBadgeLabel } from "@/utils/walkIn";
import { getOpenDaysList, getRestaurantDate, getRestaurantNow } from "@/utils/restaurantTime";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { LinkedText } from "@/components/common/LinkedText";
import OpeningHoursTable from "@/components/restaurant/OpeningHoursTable";
import BookingForm, { BookingFormData } from "@/components/booking/BookingForm";
import WalkInNotice from "@/components/booking/WalkInNotice";
import { createBooking } from "@/api/bookings";
import { convertLocalToUtc } from "@/utils/date";

/**
 * A single location in the Locations list. The collapsed header shows the same
 * at-a-glance info as the home-page card (image, name/address, today's hours,
 * walk-in badge, a live slot quick-pick). Expanding reveals the full blurb,
 * weekly hours, walk-in policy, seating, a menu link, and the booking form
 * inline (replacing the old separate booking page). The whole entry registers
 * a view ref with the parent so deep-linking can scroll to + expand it.
 */
export default function LocationListItem({
  restaurant,
  defaultExpanded = false,
  initialTime,
  initialSeats,
  registerRef,
  registerFormRef,
  onExpand,
  onScrollToForm,
}: {
  restaurant: RestaurantDto;
  defaultExpanded?: boolean;
  initialTime?: string;
  initialSeats?: number;
  registerRef: (id: number, ref: View | null) => void;
  registerFormRef?: (id: number, ref: View | null) => void;
  onExpand?: (id: number) => void;
  onScrollToForm?: (id: number) => void;
}) {
  const router = useRouter();
  const { colors, isDark, primaryColor } = useAppTheme();
  const mutedColor = colors.muted;
  const borderColor = colors.border;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [slots, setSlots] = useState<TimeSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const itemRef = useRef<View>(null);
  const formAreaRef = useRef<View>(null);

  const party = initialSeats ?? 2;

  // Register this item's view ref with the parent for scroll-anchor wiring.
  useEffect(() => {
    registerRef(restaurant.id, itemRef.current);
    return () => registerRef(restaurant.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // When told to expand by default (e.g. deep-link), scroll the booking form
  // into view once it has actually mounted. The accordion body (and thus the
  // form) mounts lazily after expand, so we trigger the scroll from the form's
  // ref callback — the moment the form node exists — rather than a fire-and-
  // forget effect that would race the accordion's mount.
  const didInitialScroll = useRef(false);
  const registerAndMaybeScrollForm = (ref: View | null) => {
    formAreaRef.current = ref;
    registerFormRef?.(restaurant.id, ref);
    if (defaultExpanded && ref && !didInitialScroll.current && onScrollToForm) {
      didInitialScroll.current = true;
      onScrollToForm(restaurant.id);
    }
  };

  // Live slot preview for today (mirrors RestaurantCard's fetch, reusing the
  // shared restaurant-time helpers so the timezone math stays in one place).
  useEffect(() => {
    const tz = restaurant.timezone ?? "UTC";
    const { totalMins, isoDay } = getRestaurantNow(tz);
    const openDaysList = getOpenDaysList(restaurant);
    if (
      (openDaysList.length > 0 && !openDaysList.includes(isoDay)) ||
      isWalkInOnlyOnDay(restaurant, isoDay) ||
      restaurant.walkInOnly
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    const date = getRestaurantDate(tz);
    fetchAvailability(restaurant.id, date, party).then((data) => {
      if (data && Array.isArray(data.slots)) {
        const future = data.slots.filter((s) => {
          if (!s.isAvailable) return false;
          const [h, m] = s.time.split(":").map(Number);
          return h * 60 + (m || 0) > totalMins;
        });
        setSlots(future.slice(0, 5));
      } else {
        setSlots([]);
      }
      setSlotsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restaurant.id,
    restaurant.timezone,
    restaurant.openDays,
    restaurant.walkInOnly,
    restaurant.walkInDays,
    party,
  ]);

  const tz = restaurant.timezone ?? "UTC";
  const { isoDay: todayIsoDay } = getRestaurantNow(tz);
  const todayHours = getHoursForDay(restaurant, todayIsoDay);
  const openDaysList = getOpenDaysList(restaurant);
  const closedToday = !openDaysList.includes(todayIsoDay);
  const hoursVary = hasCustomHours(restaurant);
  const walkInLocation = !!restaurant.walkInOnly;
  const walkInToday = !walkInLocation && isWalkInOnlyOnDay(restaurant, todayIsoDay);
  const walkInBadgeText = walkInBadgeLabel(restaurant);
  const noSlotsToday = walkInLocation || walkInToday;

  const accentHex = primaryColor.replace("#", "");
  const accentR = parseInt(accentHex.slice(0, 2), 16);
  const accentG = parseInt(accentHex.slice(2, 4), 16);
  const accentB = parseInt(accentHex.slice(4, 6), 16);
  const accentSoft = `rgba(${accentR},${accentG},${accentB},0.12)`;
  const accentBorder = `rgba(${accentR},${accentG},${accentB},0.3)`;
  const surface2 = isDark ? "#1b1e23" : "#f3efe6";

  const tags = restaurant.tags ?? [];

  const handleExpand = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next && onExpand) onExpand(restaurant.id);
      return next;
    });
  };

  // The "Book / details" CTA has booking intent, so on expand it scrolls the
  // form itself into view (like a slot press) rather than just the header —
  // unlike the generic header-click expand, which keeps the card top in view.
  const handleViewDetailsPress = () => {
    setExpanded((prev) => {
      const next = !prev;
      if (next) {
        if (onScrollToForm) onScrollToForm(restaurant.id);
        else if (onExpand) onExpand(restaurant.id);
      }
      return next;
    });
  };

  const handleSlotPress = (time: string) => {
    // Expanding with a prefilled time seeds BookingForm's initialTime via key
    // remount — the time is captured in the router query on the parent screen,
    // but here we pass it straight through initialTime since we're already on
    // the destination. We trigger expand, then scroll the form into view so
    // the user lands directly on the ready-to-fill booking form.
    setExpanded(true);
    setInitialTimeForForm(time);
    if (onScrollToForm) onScrollToForm(restaurant.id);
  };

  // Local state to carry a slot-prefilled time into the inline BookingForm,
  // remounting it (via key) so its internal state resets with the new seed.
  const [slotTime, setSlotTime] = useState<string | undefined>(initialTime);
  function setInitialTimeForForm(time: string) {
    setSlotTime(time);
  }

  const handleSubmit = async (data: BookingFormData) => {
    setSubmitError(null);
    const dateTime = convertLocalToUtc(data.date, data.time, restaurant.timezone || "UTC");
    const bookingData = {
      customerEmail: data.customerEmail,
      customerName: data.customerName,
      seats: data.seats,
      tableId: data.tableId,
      holdId: data.holdId,
      restaurantId: restaurant.id,
      sectionId:
        data.sectionId ||
        restaurant.sections.find((s) => s.tables.some((t) => t.id === data.tableId))?.id ||
        0,
      date: dateTime,
      specialRequests: data.specialRequests || null,
    };
    try {
      const newBooking = await createBooking(bookingData);
      const email = encodeURIComponent(data.customerEmail);
      if (newBooking?.bookingRef) {
        router.push(`/booking-confirmation/${newBooking.bookingRef}?email=${email}`);
      } else if (newBooking) {
        router.push(`/booking-confirmation/${newBooking.id}?email=${email}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
    }
  };

  const bookingFormKey = useMemo(
    () => `form-${restaurant.id}-${slotTime ?? "default"}`,
    [restaurant.id, slotTime]
  );

  return (
    <View
      ref={itemRef}
      style={[
        styles.item,
        { backgroundColor: colors.card, borderColor },
        expanded && { borderColor: isDark ? "#383d47" : "#cfc6b1" },
      ]}
    >
      {/* ── Image banner (clickable to expand) ── */}
      <Pressable onPress={handleExpand} style={styles.imagePress}>
        <View
          style={[
            styles.imageArea,
            restaurant.imageUrl
              ? Platform.OS === "web"
                ? ({
                    backgroundImage: `url(${restaurant.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  } as object)
                : { backgroundColor: "#111" }
              : Platform.OS === "web"
                ? ({
                    background: `linear-gradient(145deg,
                      rgb(${Math.floor(accentR * 0.1)},${Math.floor(accentG * 0.1)},${Math.floor(accentB * 0.13)}) 0%,
                      rgb(${Math.floor(accentR * 0.38)},${Math.floor(accentG * 0.38)},${Math.floor(accentB * 0.42)}) 55%,
                      rgb(${Math.floor(accentR * 0.6)},${Math.floor(accentG * 0.6)},${Math.floor(accentB * 0.65)}) 100%)`,
                  } as object)
                : {
                    backgroundColor: `rgb(${Math.floor(accentR * 0.15)},${Math.floor(accentG * 0.15)},${Math.floor(accentB * 0.18)})`,
                  },
          ]}
        >
          {restaurant.imageUrl && Platform.OS !== "web" && !imageError && (
            <Image
              source={{ uri: restaurant.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setImageError(true)}
            />
          )}

          {!restaurant.imageUrl && (
            <View style={styles.phCenter}>
              <Ionicons name="restaurant-outline" size={28} color="rgba(255,255,255,0.2)" />
              <ThemedText style={styles.phInitial}>
                {restaurant.name.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}

          <View style={styles.imageTopRow}>
            <View
              style={[
                styles.badge,
                closedToday
                  ? styles.badgeClosed
                  : { backgroundColor: `rgba(${accentR},${accentG},${accentB},0.88)` },
              ]}
            >
              {closedToday ? null : <View style={styles.badgeDot} />}
              <ThemedText style={styles.badgeText}>
                {closedToday ? "Closed today" : `Open till ${todayHours.close}`}
              </ThemedText>
            </View>
            {walkInBadgeText && (
              <View style={[styles.badge, styles.badgeWalkIn]}>
                <Ionicons name="walk-outline" size={12} color="#fff" />
                <ThemedText style={styles.badgeText}>{walkInBadgeText}</ThemedText>
              </View>
            )}
          </View>

          <View
            style={[
              styles.chevron,
              { backgroundColor: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.9)" },
            ]}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={isDark ? "#fff" : mutedColor}
            />
          </View>
        </View>
      </Pressable>

      {/* ── Header body (clickable to expand) ── */}
      <Pressable onPress={handleExpand} style={styles.headerBody}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {restaurant.name}
            </ThemedText>
            {restaurant.address ? (
              <View style={styles.meta}>
                <Ionicons name="location-outline" size={12} color={mutedColor} />
                <ThemedText style={[styles.metaText, { color: mutedColor }]} numberOfLines={1}>
                  {restaurant.address}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Blurb — visible in the collapsed card, not just when expanded */}
        {restaurant.description ? (
          <LinkedText text={restaurant.description} style={styles.description} />
        ) : null}

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((t) => (
              <View
                key={t}
                style={[styles.tag, { backgroundColor: accentSoft, borderColor: accentBorder }]}
              >
                <ThemedText style={[styles.tagText, { color: primaryColor }]}>{t}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Menu link — visible in the collapsed card, not just when expanded.
            Nested inside the header's expand Pressable, so stop propagation to
            open the menu instead of also toggling the accordion. */}
        {restaurant.menuUrl ? (
          <Pressable
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.menuLink,
              {
                backgroundColor: hovered || pressed ? accentSoft : surface2,
                borderColor: hovered || pressed ? accentBorder : borderColor,
              },
            ]}
            onPress={(e) => {
              e?.stopPropagation?.();
              Linking.openURL(restaurant.menuUrl!);
            }}
            accessibilityRole="link"
            accessibilityLabel="View menu"
          >
            <Ionicons name="document-text-outline" size={16} color={primaryColor} />
            <ThemedText style={[styles.menuLinkText, { color: primaryColor }]}>
              View menu
            </ThemedText>
            <Ionicons
              name="open-outline"
              size={13}
              color={mutedColor}
              style={{ marginLeft: "auto" }}
            />
          </Pressable>
        ) : null}

        {/* Hours + slot quick-pick */}
        <View style={styles.slotsArea}>
          {noSlotsToday ? (
            <View style={styles.walkInEmptyState}>
              <Ionicons name="walk-outline" size={18} color={mutedColor} />
              <ThemedText style={[styles.walkInEmptyText, { color: mutedColor }]}>
                No reservations required
              </ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.slotLabel}>
                <ThemedText style={[styles.slotLabelText, { color: mutedColor }]}>
                  Available slots
                </ThemedText>
                <ThemedText style={[styles.slotLabelWhen, { color: colors.text }]}>
                  {party} {party === 1 ? "guest" : "guests"} · today
                </ThemedText>
              </View>
              {slotsLoading ? (
                <ActivityIndicator
                  size="small"
                  color={primaryColor}
                  style={{ alignSelf: "flex-start" }}
                />
              ) : slots.length === 0 ? (
                <ThemedText style={[styles.noSlotsText, { color: mutedColor }]}>
                  No available slots today
                </ThemedText>
              ) : (
                <View style={styles.slotRow}>
                  {slots.map((s) => (
                    <Pressable
                      key={s.time}
                      onPress={() => handleSlotPress(s.time)}
                      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                        styles.slot,
                        {
                          backgroundColor: hovered || pressed ? primaryColor : surface2,
                          borderColor: hovered || pressed ? primaryColor : borderColor,
                        },
                      ]}
                    >
                      <ThemedText style={styles.slotText}>{s.time}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={[styles.headerFoot, { borderTopColor: borderColor }]}>
          <View style={styles.hoursRow}>
            <Ionicons name="time-outline" size={12} color={mutedColor} style={{ marginRight: 5 }} />
            {closedToday ? (
              <ThemedText style={[styles.hoursTime, { color: colors.text }]}>
                Closed today
              </ThemedText>
            ) : (
              <>
                <ThemedText style={[styles.hoursText, { color: mutedColor }]}>
                  {hoursVary ? "Today " : "Open "}
                </ThemedText>
                <ThemedText style={[styles.hoursTime, { color: colors.text }]}>
                  {todayHours.open} – {todayHours.close}
                </ThemedText>
              </>
            )}
          </View>
          <Pressable
            onPress={(e) => {
              e?.stopPropagation?.();
              handleViewDetailsPress();
            }}
            style={[styles.viewBtn, { backgroundColor: surface2 }]}
          >
            <ThemedText style={[styles.viewBtnText, { color: primaryColor }]}>
              {expanded ? "Hide details" : "Book / details"}
            </ThemedText>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={13}
              color={primaryColor}
            />
          </Pressable>
        </View>
      </Pressable>

      {/* ── Expanded body ── */}
      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.expandedBody, { borderTopColor: borderColor }]}>
          {/* Address + maps */}
          {restaurant.address && (
            <View style={styles.mapLinks}>
              <Pressable
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.mapLink,
                  {
                    backgroundColor: surface2,
                    borderColor: hovered || pressed ? primaryColor : borderColor,
                  },
                ]}
                onPress={() =>
                  Linking.openURL(
                    `https://maps.google.com/?q=${encodeURIComponent(restaurant.address || "")}`
                  )
                }
                accessibilityLabel="Open in Google Maps"
              >
                <Ionicons name="navigate-outline" size={12} color={mutedColor} />
                <ThemedText style={[styles.mapLinkText, { color: mutedColor }]}>
                  Google Maps
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.mapLink,
                  {
                    backgroundColor: surface2,
                    borderColor: hovered || pressed ? primaryColor : borderColor,
                  },
                ]}
                onPress={() =>
                  Linking.openURL(
                    `https://maps.apple.com/?q=${encodeURIComponent(restaurant.address || "")}`
                  )
                }
                accessibilityLabel="Open in Apple Maps"
              >
                <Ionicons name="navigate-outline" size={12} color={mutedColor} />
                <ThemedText style={[styles.mapLinkText, { color: mutedColor }]}>
                  Apple Maps
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Full weekly hours */}
          <View style={styles.subSection}>
            <ThemedText type="defaultSemiBold" style={styles.subHeading}>
              Opening hours
            </ThemedText>
            <OpeningHoursTable restaurant={restaurant} />
          </View>

          {/* Walk-in policy / booking form. Ref'd so a slot press or deep link
              can scroll the form itself into view (not just the card top). */}
          <View ref={registerAndMaybeScrollForm} style={styles.subSection}>
            {walkInLocation ? (
              <WalkInNotice scope="location" />
            ) : (
              <>
                <ThemedText type="defaultSemiBold" style={styles.subHeading}>
                  Book a table
                </ThemedText>
                {submitError && (
                  <ThemedView style={styles.errorBanner}>
                    <ThemedText style={styles.errorText}>{submitError}</ThemedText>
                  </ThemedView>
                )}
                <ThemedView
                  style={[styles.bookingCard, { backgroundColor: colors.card, borderColor }]}
                >
                  <BookingForm
                    key={bookingFormKey}
                    restaurant={restaurant}
                    onSubmit={handleSubmit}
                    onRefresh={() => setSlotTime((t) => t)}
                    initialTime={slotTime}
                    initialSeats={initialSeats}
                  />
                </ThemedView>
              </>
            )}
          </View>

          {/* Seating / sections (always available for reference) */}
          {restaurant.sections.length > 0 && (
            <View style={styles.subSection}>
              <ThemedText type="defaultSemiBold" style={styles.subHeading}>
                Seating &amp; tables
              </ThemedText>
              <View style={styles.sectionsGrid}>
                {restaurant.sections.map((section) => (
                  <ThemedView key={section.id} style={[styles.sectionCard, { borderColor }]}>
                    <ThemedText style={styles.sectionName}>{section.name}</ThemedText>
                    <View style={styles.tableGrid}>
                      {section.tables.map((table) => (
                        <View
                          key={table.id}
                          style={[
                            styles.tableChip,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(0,0,0,0.04)",
                              borderColor,
                            },
                          ]}
                        >
                          <ThemedText style={styles.tableName}>
                            {table.name ?? `Table ${table.id}`}
                          </ThemedText>
                          <ThemedText style={[styles.tableSeats, { color: mutedColor }]}>
                            {table.seats} seats
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </ThemedView>
                ))}
              </View>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    overflow: "hidden",
  },
  imagePress: {
    width: "100%",
  },
  imageArea: {
    aspectRatio: 21 / 9,
    position: "relative",
    overflow: "hidden",
  },
  phCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  phInitial: {
    fontSize: 44,
    fontWeight: "700",
    color: "rgba(255,255,255,0.28)",
    letterSpacing: -1.5,
  },
  imageTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 56,
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  badgeClosed: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgeWalkIn: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "500",
  },
  chevron: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: {
    padding: 16,
    gap: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 13,
  },
  tags: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11.5,
  },
  slotsArea: {
    minHeight: 64,
  },
  walkInEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  walkInEmptyText: {
    fontSize: 12.5,
    fontStyle: "italic",
  },
  slotLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  slotLabelText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "600",
  },
  slotLabelWhen: {
    fontSize: 12,
    fontWeight: "500",
  },
  slotRow: {
    flexDirection: "row",
    gap: 6,
  },
  slot: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  noSlotsText: {
    fontSize: 12.5,
    fontStyle: "italic",
  },
  headerFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hoursText: {
    fontSize: 13,
  },
  hoursTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  expandedBody: {
    padding: 16,
    gap: 24,
    borderTopWidth: 1,
  },
  mapLinks: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapLinkText: {
    fontSize: 12.5,
    fontWeight: "500",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  menuLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
  },
  menuLinkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  subSection: {
    gap: 12,
  },
  subHeading: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  bookingCard: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
  },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: theme.borderRadius.md,
    padding: 12,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
  },
  sectionsGrid: {
    gap: 10,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    gap: 10,
  },
  sectionName: {
    fontSize: 15,
    fontWeight: "600",
  },
  tableGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tableChip: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 11,
    paddingVertical: 7,
    alignItems: "center",
    gap: 2,
  },
  tableName: {
    fontSize: 13,
    fontWeight: "500",
  },
  tableSeats: {
    fontSize: 11.5,
  },
});
