import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { hexToRgba } from "@/utils/colors";
import { COLORS, BORDER_RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from "@/theme/theme";
import { fetchRestaurants } from "@/api/restaurants";
import {
  getNotifications,
  markRead,
  markAllRead,
  subscribePush,
  getVapidPublicKey,
  AdminNotificationDto,
  NotificationType,
} from "@/api/notifications";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

const PAGE_SIZE = 20;
const PIN_STORAGE_KEY = "openresto_pinned_notifs";

const TYPE_LABELS: Record<NotificationType, string> = {
  BookingCreated: "New Booking",
  BookingCancelled: "Booking Cancelled",
  RestaurantNearlyFull: "Nearly Full",
};

type TypeIcon = {
  name: "checkmark-circle-outline" | "close-circle-outline" | "warning-outline";
  color: string;
};

const TYPE_ICONS: Record<NotificationType, TypeIcon> = {
  BookingCreated: { name: "checkmark-circle-outline", color: COLORS.success },
  BookingCancelled: { name: "close-circle-outline", color: COLORS.error },
  RestaurantNearlyFull: { name: "warning-outline", color: COLORS.warning },
};

const TYPE_FILTERS = [
  { label: "All Types", value: "" },
  { label: "New Bookings", value: "BookingCreated" },
  { label: "Cancelled", value: "BookingCancelled" },
  { label: "Nearly Full", value: "RestaurantNearlyFull" },
];

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatBookingDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PushStatus = "unknown" | "active" | "inactive" | "denied" | "unsupported";

function usePushStatus(vapidKey: string | null | undefined) {
  const [status, setStatus] = useState<PushStatus>("unknown");

  useEffect(() => {
    if (Platform.OS !== "web" || vapidKey === undefined) return;
    if (vapidKey === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unsupported");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (sw) => {
      const existing = await sw.pushManager.getSubscription();
      setStatus(existing ? "active" : "inactive");
    });
  }, [vapidKey]);

  return [status, setStatus] as const;
}

function PushBanner({
  restaurantId,
  primaryColor,
  isDark,
}: {
  restaurantId: number | null;
  primaryColor: string;
  isDark: boolean;
}) {
  const [vapidKey, setVapidKey] = useState<string | null | undefined>(undefined);
  const [pushStatus, setPushStatus] = usePushStatus(vapidKey);
  const [working, setWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    getVapidPublicKey().then(setVapidKey);
  }, []);

  if (Platform.OS !== "web") return null;
  if (vapidKey === undefined) return null;
  if (pushStatus === "unsupported" || pushStatus === "active" || pushStatus === "unknown")
    return null;

  const handleEnable = async () => {
    if (!vapidKey) return;
    setWorking(true);
    setErrorMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setPushStatus("denied");
        setErrorMsg("Blocked by browser — allow notifications in site settings.");
        setWorking(false);
        return;
      }
      if (permission !== "granted") {
        setWorking(false);
        return;
      }
      const sw = await navigator.serviceWorker.ready;
      const sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const p256dhBuffer = sub.getKey("p256dh");
      const authBuffer = sub.getKey("auth");
      if (!p256dhBuffer || !authBuffer) throw new Error("Missing push keys");
      await subscribePush(restaurantId ?? 0, {
        endpoint: sub.endpoint,
        p256dh: arrayBufferToBase64(p256dhBuffer),
        auth: arrayBufferToBase64(authBuffer),
      });
      setPushStatus("active");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setErrorMsg("Failed to enable — try again.");
    }
    setWorking(false);
  };

  if (pushStatus === "denied") {
    return (
      <View
        style={[
          styles.pushBanner,
          {
            borderColor: isDark ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.25)",
            backgroundColor: isDark ? "rgba(245,158,11,0.07)" : "rgba(245,158,11,0.04)",
          },
        ]}
      >
        <Ionicons name="notifications-off-outline" size={16} color={COLORS.warning} />
        <ThemedText style={[styles.pushBannerText, { color: COLORS.warning }]}>
          Push notifications blocked — enable in browser site settings.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.pushBanner,
        {
          borderColor: isDark ? hexToRgba(primaryColor, 0.25) : hexToRgba(primaryColor, 0.2),
          backgroundColor: isDark ? hexToRgba(primaryColor, 0.07) : hexToRgba(primaryColor, 0.04),
        },
      ]}
    >
      <Ionicons name="notifications-outline" size={16} color={primaryColor} />
      <ThemedText style={[styles.pushBannerText, { color: primaryColor }]}>
        Enable push notifications to get real-time booking alerts.
      </ThemedText>
      {errorMsg && (
        <ThemedText style={[styles.pushBannerText, { color: COLORS.error, flex: undefined }]}>
          {errorMsg}
        </ThemedText>
      )}
      <Pressable
        onPress={handleEnable}
        disabled={working}
        style={[
          styles.pushBannerBtn,
          { backgroundColor: primaryColor, opacity: working ? 0.7 : 1 },
        ]}
      >
        {working ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <ThemedText style={styles.pushBannerBtnText}>Enable</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

export default function NotificationsScreen() {
  const { colors, primaryColor, isDark } = useAppTheme();
  const router = useRouter();

  const [restaurants, setRestaurants] = useState<{ id: number; name: string }[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [items, setItems] = useState<AdminNotificationDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [popupBookingId, setPopupBookingId] = useState<number | null>(null);

  // Pin state persisted in localStorage
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(() => {
    if (Platform.OS !== "web") return new Set();
    try {
      const s = localStorage.getItem(PIN_STORAGE_KEY);
      return s ? new Set(JSON.parse(s) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });

  // Local unread overrides — frontend-only, resets on page reload
  const [localUnreadIds, setLocalUnreadIds] = useState<Set<number>>(new Set());
  const localUnreadRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    localUnreadRef.current = localUnreadIds;
  }, [localUnreadIds]);

  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;

  useEffect(() => {
    fetchRestaurants().then((data) => setRestaurants(data));
  }, []);

  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(false);
      const result = await getNotifications({
        restaurantId: selectedRestaurantId ?? undefined,
        type: selectedType || undefined,
        unreadOnly: unreadOnly || undefined,
        page: pageNum,
        pageSize: PAGE_SIZE,
      });
      if (replace) setLoading(false);
      else setLoadingMore(false);
      if (!result) {
        setError(true);
        return;
      }
      const applyOverrides = (list: AdminNotificationDto[]) => {
        const overrides = localUnreadRef.current;
        return overrides.size > 0
          ? list.map((x) => (overrides.has(x.id) ? { ...x, isRead: false } : x))
          : list;
      };
      if (replace) setItems(applyOverrides(result.items));
      else setItems((prev) => [...prev, ...applyOverrides(result.items)]);
      setTotalCount(result.totalCount ?? 0);
    },
    [selectedRestaurantId, selectedType, unreadOnly]
  );

  const silentRefresh = useCallback(async () => {
    const result = await getNotifications({
      restaurantId: selectedRestaurantId ?? undefined,
      type: selectedType || undefined,
      unreadOnly: unreadOnly || undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    });
    if (!result) return;
    setItems((prev) => {
      const existingIds = new Set(prev.map((x) => x.id));
      const newItems = result.items.filter((x) => !existingIds.has(x.id));
      const merged = newItems.length > 0 ? [...newItems, ...prev] : prev;
      const overrides = localUnreadRef.current;
      return overrides.size > 0
        ? merged.map((x) => (overrides.has(x.id) ? { ...x, isRead: false } : x))
        : merged;
    });
    setTotalCount(result.totalCount ?? 0);
  }, [selectedRestaurantId, selectedType, unreadOnly]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    loadPage(1, true);
  }, [selectedRestaurantId, selectedType, unreadOnly, loadPage]);

  useEffect(() => {
    const id = setInterval(silentRefresh, 30000);
    return () => clearInterval(id);
  }, [silentRefresh]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage, false);
  };

  const handleRowTap = async (n: AdminNotificationDto) => {
    if (!n.isRead) {
      await markRead(n.id);
      setLocalUnreadIds((prev) => {
        const s = new Set(prev);
        s.delete(n.id);
        return s;
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    if (n.bookingId != null) {
      setPopupBookingId(n.bookingId);
    } else if (n.type === "RestaurantNearlyFull") {
      router.push(`/(admin)/bookings?restaurantId=${n.restaurantId}`);
    }
  };

  const handleMarkRead = async (id: number) => {
    await markRead(id);
    setLocalUnreadIds((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
  };

  const handleMarkUnread = (id: number) => {
    setLocalUnreadIds((prev) => new Set([...prev, id]));
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: false } : x)));
  };

  const togglePin = (id: number) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (Platform.OS === "web") {
        try {
          localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([...next]));
        } catch {}
      }
      return next;
    });
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    if (selectedRestaurantId != null) {
      await markAllRead(selectedRestaurantId);
    } else {
      await Promise.all(restaurants.map((r) => markAllRead(r.id)));
    }
    setMarkingAll(false);
    setLocalUnreadIds(new Set());
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
  };

  const hasMore = items.length < totalCount;
  const unreadCount = items.filter((x) => !x.isRead).length;

  // Pinned items float to top within the current filtered list
  const { pinnedItems, unpinnedItems } = useMemo(
    () => ({
      pinnedItems: items.filter((x) => pinnedIds.has(x.id)),
      unpinnedItems: items.filter((x) => !pinnedIds.has(x.id)),
    }),
    [items, pinnedIds]
  );

  const renderRow = (
    n: AdminNotificationDto,
    index: number,
    list: AdminNotificationDto[],
    showDivider: boolean
  ) => {
    const typeIcon = TYPE_ICONS[n.type];
    const isLast = index === list.length - 1 && !showDivider && !hasMore;
    const isPinned = pinnedIds.has(n.id);
    const meta = [
      n.restaurantName,
      n.seats > 0 ? `${n.seats} guest${n.seats !== 1 ? "s" : ""}` : null,
      n.bookingDate ? formatBookingDate(n.bookingDate) : null,
      relativeTime(n.createdAt),
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <Pressable
        key={n.id}
        onPress={() => handleRowTap(n)}
        style={(state) => [
          styles.notifRow,
          !isLast && { borderBottomWidth: 1, borderBottomColor: borderColor },
          (state as { hovered?: boolean }).hovered && {
            backgroundColor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)",
          },
        ]}
      >
        {/* Unread accent bar */}
        <View
          style={[styles.accentBar, { backgroundColor: !n.isRead ? primaryColor : "transparent" }]}
        />

        {/* Type icon */}
        <View style={[styles.notifIcon, { backgroundColor: hexToRgba(typeIcon.color, 0.1) }]}>
          <Ionicons name={typeIcon.name} size={18} color={typeIcon.color} />
        </View>

        {/* Text content */}
        <View style={styles.notifBody}>
          <View style={styles.notifTitleRow}>
            <ThemedText style={styles.notifType}>{TYPE_LABELS[n.type]}</ThemedText>
            {n.bookingRef ? (
              <ThemedText style={[styles.notifRef, { color: mutedColor }]}>
                #{n.bookingRef}
              </ThemedText>
            ) : null}
            {!n.isRead && <View style={[styles.unreadPip, { backgroundColor: primaryColor }]} />}
          </View>

          {n.type !== "RestaurantNearlyFull" && n.customerName ? (
            <ThemedText style={styles.notifName}>{n.customerName}</ThemedText>
          ) : null}

          <ThemedText style={[styles.notifMeta, { color: mutedColor }]}>{meta}</ThemedText>
        </View>

        {/* Action buttons — nested Pressables so they don't trigger row navigation */}
        <View style={styles.rowActions}>
          <Pressable
            onPress={() => togglePin(n.id)}
            hitSlop={6}
            style={[
              styles.actionPinBtn,
              {
                borderColor: isPinned ? primaryColor : borderColor,
                backgroundColor: isPinned ? hexToRgba(primaryColor, 0.1) : "transparent",
              },
            ]}
          >
            <ThemedText
              style={[styles.actionText, { color: isPinned ? primaryColor : mutedColor }]}
            >
              {isPinned ? "Unpin" : "Pin"}
            </ThemedText>
          </Pressable>
          {n.isRead ? (
            <Pressable
              onPress={() => handleMarkUnread(n.id)}
              hitSlop={6}
              style={[styles.actionToggleBtn, { borderColor }]}
            >
              <ThemedText style={[styles.actionText, { color: mutedColor }]}>
                Mark Unread
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => handleMarkRead(n.id)}
              hitSlop={6}
              style={[styles.actionToggleBtn, { borderColor }]}
            >
              <ThemedText style={[styles.actionText, { color: mutedColor }]}>Mark Read</ThemedText>
            </Pressable>
          )}
        </View>

        {/* Navigate arrow */}
        {(n.bookingId != null || n.type === "RestaurantNearlyFull") && (
          <Ionicons name="chevron-forward" size={15} color={mutedColor} />
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Notifications" }} />}

      {/* ── Page header ─────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View style={styles.headerRow}>
          <View style={styles.pageTitleRow}>
            <ThemedText type="h1">Notifications</ThemedText>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]}>
                <ThemedText style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Mark all read — always visible, dimmed when nothing to mark */}
          <Pressable
            onPress={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            style={[styles.markAllBtn, { opacity: unreadCount === 0 ? 0.35 : 1 }]}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Ionicons name="checkmark-done-outline" size={14} color={primaryColor} />
            )}
            <ThemedText style={[styles.markAllText, { color: primaryColor }]}>
              {markingAll ? "Marking…" : "Mark all read"}
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
          {loading ? "Loading…" : `${totalCount} total notification${totalCount !== 1 ? "s" : ""}`}
        </ThemedText>
      </View>

      {/* ── Push banner ─────────────────────────────────────────────── */}
      <PushBanner
        restaurantId={selectedRestaurantId ?? restaurants[0]?.id ?? null}
        primaryColor={primaryColor}
        isDark={isDark}
      />

      {/* ── Filters — bare pills, no card wrapper ───────────────────── */}
      <View style={styles.filtersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillRow}
        >
          {[{ id: null, name: "All locations" }, ...restaurants].map((r) => {
            const active =
              r.id === null ? selectedRestaurantId === null : selectedRestaurantId === r.id;
            return (
              <Pressable
                key={r.id ?? "all"}
                onPress={() => setSelectedRestaurantId(r.id)}
                style={[
                  styles.pill,
                  active
                    ? { backgroundColor: primaryColor, borderColor: primaryColor }
                    : { backgroundColor: "transparent", borderColor },
                ]}
              >
                <ThemedText style={[styles.pillText, { color: active ? "#fff" : mutedColor }]}>
                  {r.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.pillRow2}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={styles.pillRow}
          >
            {TYPE_FILTERS.map((f) => {
              const active = selectedType === f.value;
              return (
                <Pressable
                  key={f.value}
                  onPress={() => setSelectedType(f.value)}
                  style={[
                    styles.pill,
                    active
                      ? {
                          backgroundColor: hexToRgba(primaryColor, 0.12),
                          borderColor: primaryColor,
                        }
                      : { backgroundColor: "transparent", borderColor },
                  ]}
                >
                  <ThemedText
                    style={[styles.pillText, { color: active ? primaryColor : mutedColor }]}
                  >
                    {f.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => setUnreadOnly((v) => !v)}
            style={[
              styles.pill,
              styles.pillRow,
              { gap: 5 },
              unreadOnly
                ? { backgroundColor: hexToRgba(primaryColor, 0.12), borderColor: primaryColor }
                : { backgroundColor: "transparent", borderColor },
            ]}
          >
            <View
              style={[
                styles.unreadDot,
                { backgroundColor: unreadOnly ? primaryColor : mutedColor },
              ]}
            />
            <ThemedText
              style={[styles.pillText, { color: unreadOnly ? primaryColor : mutedColor }]}
            >
              Filter Unread
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconRing, { borderColor }]}>
            <Ionicons name="warning-outline" size={28} color={mutedColor} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
            Something went wrong
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
            Could not load notifications. Check your connection and try again.
          </ThemedText>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconRing, { borderColor }]}>
            <Ionicons
              name={unreadOnly ? "checkmark-circle-outline" : "notifications-off-outline"}
              size={28}
              color={mutedColor}
            />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
            {unreadOnly ? "All caught up" : "No notifications yet"}
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
            {unreadOnly
              ? "You've read everything. New alerts will appear here."
              : "Booking events and capacity alerts will appear here."}
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.listCard, { backgroundColor: cardBg, borderColor }]}>
          {/* Pinned section */}
          {pinnedItems.length > 0 && (
            <>
              <View style={[styles.sectionDivider, { borderBottomColor: borderColor }]}>
                <Ionicons name="bookmark" size={11} color={primaryColor} />
                <ThemedText style={[styles.sectionLabel, { color: primaryColor }]}>
                  Pinned
                </ThemedText>
              </View>
              {pinnedItems.map((n, i) => renderRow(n, i, pinnedItems, unpinnedItems.length > 0))}
              {unpinnedItems.length > 0 && (
                <View
                  style={[
                    styles.sectionDivider,
                    {
                      borderBottomColor: borderColor,
                      borderTopColor: borderColor,
                      borderTopWidth: 1,
                    },
                  ]}
                >
                  <ThemedText style={[styles.sectionLabel, { color: mutedColor }]}>
                    All notifications
                  </ThemedText>
                </View>
              )}
            </>
          )}

          {/* Main list */}
          {unpinnedItems.map((n, i) => renderRow(n, i, unpinnedItems, false))}

          {hasMore && (
            <Pressable
              onPress={handleLoadMore}
              disabled={loadingMore}
              style={[
                styles.loadMoreBtn,
                { borderTopColor: borderColor, opacity: loadingMore ? 0.6 : 1 },
              ]}
            >
              {loadingMore && <ActivityIndicator size="small" color={primaryColor} />}
              <ThemedText style={[styles.loadMoreText, { color: mutedColor }]}>
                {loadingMore ? "Loading…" : `Show ${totalCount - items.length} more`}
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}

      <BookingDetailPopup bookingId={popupBookingId} onClose={() => setPopupBookingId(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xxl,
    paddingTop: SPACING.xxxl,
    gap: SPACING.lg,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },

  // ── Header
  pageHeader: { gap: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  pageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pageSub: { ...TYPOGRAPHY.body },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginTop: 2,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 14,
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Push banner
  pushBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    flexWrap: "wrap",
  },
  pushBannerText: { fontSize: 13, flex: 1, lineHeight: 18 },
  pushBannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 68,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pushBannerBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // ── Filters
  filtersSection: { gap: 8 },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  pillRow2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
  unreadDot: { width: 6, height: 6, borderRadius: 3 },

  // ── List card
  listCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: SPACING.lg,
    paddingVertical: 13,
    gap: 10,
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
    borderRadius: 2,
    minHeight: 40,
  },
  notifIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifBody: { flex: 1, gap: 2 },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  notifType: { fontSize: 13, fontWeight: "700" },
  notifRef: { fontSize: 12 },
  unreadPip: { width: 6, height: 6, borderRadius: 3 },
  notifName: { fontSize: 14, fontWeight: "500", lineHeight: 20 },
  notifMeta: { fontSize: 12, lineHeight: 17 },

  // ── Per-row actions
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionPinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    minWidth: 52,
  },
  actionToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    width: 106,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Empty / error states
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 72,
    gap: SPACING.md,
  },
  emptyIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
    textAlign: "center",
  },
  emptyBody: {
    ...TYPOGRAPHY.body,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },

  // ── Load more
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  loadMoreText: { fontSize: 13, fontWeight: "500" },
});
