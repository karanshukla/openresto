import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, View, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { hexToRgba } from "@/utils/colors";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { fetchRestaurants } from "@/api/restaurants";
import {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  deleteNotifications,
  AdminNotificationDto,
} from "@/api/notifications";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";
import ConfirmModal from "@/components/common/ConfirmModal";
import { PushBanner } from "@/components/admin/notifications/PushBanner";
import { NotificationRow } from "@/components/admin/notifications/NotificationRow";
import { PAGE_SIZE, PIN_STORAGE_KEY, getTypeFilters } from "@/utils/notifications";
import { styles } from "@/components/admin/notifications/notifications.styles";
import HorizontalScroller from "@/components/common/HorizontalScroller";
import { Icon } from "@/components/common/Icon";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  const router = useRouter();
  const typeFilters = getTypeFilters(t);

  const [restaurants, setRestaurants] = useState<{ id: number; name: string }[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = usePersistedState<number | null>(
    "notifications:restaurantId",
    null
  );
  const [selectedType, setSelectedType] = usePersistedState<string>("notifications:type", "");
  // "unread only" is transient: once items are read, the filter would show nothing on the next visit.
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [items, setItems] = useState<AdminNotificationDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [popupBookingId, setPopupBookingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }, []);
  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    []
  );

  const [pinnedIds, setPinnedIds] = useState<Set<number>>(() => {
    if (Platform.OS !== "web") return new Set();
    try {
      const s = localStorage.getItem(PIN_STORAGE_KEY);
      return s ? new Set(JSON.parse(s) as number[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const [sessionUnreadOverrides, setSessionUnreadOverrides] = useState<Set<number>>(new Set());
  const localUnreadRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    localUnreadRef.current = sessionUnreadOverrides;
  }, [sessionUnreadOverrides]);

  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;

  useEffect(() => {
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      // Drop a persisted selection whose restaurant was since deleted.
      if (selectedRestaurantId != null && !data.some((r) => r.id === selectedRestaurantId)) {
        setSelectedRestaurantId(null);
      }
    });
    // selectedRestaurantId seeds the initial filter only; omitting it avoids a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSessionUnreadOverrides((prev) => {
        const s = new Set(prev);
        s.delete(n.id);
        return s;
      });
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    if (n.bookingId != null) {
      setPopupBookingId(n.bookingId);
    } else if (n.type === "RestaurantNearlyFull") {
      router.push(`/admin/bookings?restaurantId=${n.restaurantId}`);
    }
  };

  const handleMarkRead = async (id: number) => {
    await markRead(id);
    setSessionUnreadOverrides((prev) => {
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
  };

  const handleMarkUnread = (id: number) => {
    setSessionUnreadOverrides((prev) => new Set([...prev, id]));
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
    setSessionUnreadOverrides(new Set());
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    showToast(t("admin.notifications.markedAllReadToast"));
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setTotalCount((prev) => Math.max(0, prev - 1));
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast(t("admin.notifications.notificationDeletedToast"));
    await deleteNotification(id);
  };

  const requestDelete = (id: number) => {
    if (pinnedIds.has(id)) {
      setConfirmDeleteId(id);
    } else {
      handleDelete(id);
    }
  };

  const handleConfirmedDelete = async () => {
    // istanbul ignore next -- defensive guard: this is only ever wired to the confirm
    // modal's onConfirm, which is rendered exclusively while confirmDeleteId is non-null.
    if (confirmDeleteId == null) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    await handleDelete(id);
  };

  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const deleteAllUnpinnedVisible = async () => {
    const idsToDelete = items.filter((x) => !pinnedIds.has(x.id)).map((x) => x.id);
    if (idsToDelete.length === 0) {
      showToast(t("admin.notifications.allVisiblePinnedToast"));
      return;
    }
    setDeletingAll(true);
    await deleteNotifications(idsToDelete);
    setItems((prev) => prev.filter((x) => pinnedIds.has(x.id)));
    setTotalCount((prev) => Math.max(0, prev - idsToDelete.length));
    setDeletingAll(false);
    showToast(t("admin.notifications.deletedCountToast", { count: idsToDelete.length }));
  };

  // On web, only allow swipe-to-delete for touch pointers (not mouse drags).
  // The Pointer Events API exposes pointerType ("mouse" | "touch" | "pen") on every
  // pointerdown event — we capture it in the capture phase before RNGH sees the event.
  const [webTouchActive, setWebTouchActive] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const fn = (e: PointerEvent) => setWebTouchActive(e.pointerType === "touch");
    document.addEventListener("pointerdown", fn, true);
    return () => document.removeEventListener("pointerdown", fn, true);
  }, []);

  const [clearingRead, setClearingRead] = useState(false);
  const handleClearRead = async () => {
    const readIds = items.filter((x) => x.isRead && !pinnedIds.has(x.id)).map((x) => x.id);
    // istanbul ignore next -- defensive guard: the "Clear read" button is disabled
    // under this exact condition (see `!hasRead` below), so it can't be pressed empty.
    if (readIds.length === 0) return;
    setClearingRead(true);
    await deleteNotifications(readIds);
    setItems((prev) => prev.filter((x) => !readIds.includes(x.id)));
    setTotalCount((prev) => Math.max(0, prev - readIds.length));
    setClearingRead(false);
    showToast(t("admin.notifications.readClearedToast"));
  };

  const hasMore = items.length < totalCount;
  const unreadCount = items.filter((x) => !x.isRead).length;

  const pinnedFirst = useMemo(
    () => ({
      pinnedItems: items.filter((x) => pinnedIds.has(x.id)),
      unpinnedItems: items.filter((x) => !pinnedIds.has(x.id)),
    }),
    [items, pinnedIds]
  );
  const { pinnedItems, unpinnedItems } = pinnedFirst;

  const renderRow = (
    n: AdminNotificationDto,
    index: number,
    list: AdminNotificationDto[],
    showDivider: boolean
  ) => {
    const isLast = index === list.length - 1 && !showDivider && !hasMore;
    return (
      <NotificationRow
        key={n.id}
        notification={n}
        isPinned={pinnedIds.has(n.id)}
        isLast={isLast}
        webTouchActive={webTouchActive}
        borderColor={borderColor}
        cardBg={cardBg}
        mutedColor={mutedColor}
        isDark={isDark}
        primaryColor={primaryColor}
        onRowTap={handleRowTap}
        onTogglePin={togglePin}
        onMarkRead={handleMarkRead}
        onMarkUnread={handleMarkUnread}
        onRequestDelete={requestDelete}
        onSwipeDelete={handleDelete}
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {Platform.OS !== "web" && (
          <Stack.Screen options={{ title: t("admin.notifications.pageTitle") }} />
        )}

        <View style={styles.pageHeader}>
          <View style={styles.headerRow}>
            <View style={styles.pageTitleRow}>
              <ThemedText type="h1">{t("admin.notifications.pageTitle")}</ThemedText>
              {unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]}>
                  <ThemedText style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* One filled button per cluster: marking read is the routine action, so the two
                destructive ones sit at outlined weight beside it rather than shouting equally. */}
            <ButtonRow style={styles.headerActions}>
              <Button
                variant="secondary"
                tone="danger"
                size="md"
                icon="trash-outline"
                onPress={() => setConfirmDeleteAll(true)}
                disabled={deletingAll || items.length === 0}
                loading={deletingAll}
                accessibilityLabel={t("admin.notifications.deleteAllLabel")}
                accessibilityHint={t("admin.notifications.deleteAllHint")}
              >
                {deletingAll
                  ? t("admin.notifications.deletingAll")
                  : t("admin.notifications.deleteAll")}
              </Button>

              {(() => {
                const hasRead = items.some((x) => x.isRead && !pinnedIds.has(x.id));
                return (
                  <Button
                    variant="secondary"
                    tone="danger"
                    size="md"
                    icon="checkmark-circle-outline"
                    onPress={handleClearRead}
                    disabled={clearingRead || !hasRead}
                    loading={clearingRead}
                    accessibilityLabel={t("admin.notifications.clearReadLabel")}
                  >
                    {clearingRead
                      ? t("admin.notifications.clearingRead")
                      : t("admin.notifications.clearRead")}
                  </Button>
                );
              })()}

              <Button
                size="md"
                icon="checkmark-done-outline"
                onPress={handleMarkAllRead}
                disabled={markingAll || unreadCount === 0}
                loading={markingAll}
                accessibilityLabel={t("admin.notifications.markAllReadLabel")}
              >
                {markingAll
                  ? t("admin.notifications.markingAllRead")
                  : t("admin.notifications.markAllRead")}
              </Button>
            </ButtonRow>
          </View>

          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {loading
              ? t("common.status.loading")
              : t("admin.notifications.totalCount", { count: totalCount })}
          </ThemedText>
        </View>

        <PushBanner
          restaurantId={selectedRestaurantId ?? restaurants[0]?.id ?? null}
          primaryColor={primaryColor}
          isDark={isDark}
        />

        <View style={styles.filtersSection}>
          <HorizontalScroller
            label={t("admin.notifications.locationsScrollerLabel")}
            contentContainerStyle={styles.pillRow}
          >
            {[{ id: null, name: t("admin.notifications.allLocations") }, ...restaurants].map(
              (r) => {
                const active =
                  r.id === null ? selectedRestaurantId === null : selectedRestaurantId === r.id;
                return (
                  <Pressable
                    key={r.id ?? "all"}
                    onPress={() => setSelectedRestaurantId(r.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={r.name}
                    accessibilityState={{ checked: active }}
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
              }
            )}
          </HorizontalScroller>

          <View style={styles.pillRow2}>
            <HorizontalScroller
              label={t("admin.notifications.typesScrollerLabel")}
              contentContainerStyle={styles.pillRow}
            >
              {typeFilters.map((f) => {
                const active = selectedType === f.value;
                return (
                  <Pressable
                    key={f.value}
                    onPress={() => setSelectedType(f.value)}
                    accessibilityRole="radio"
                    accessibilityLabel={f.label}
                    accessibilityState={{ checked: active }}
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
            </HorizontalScroller>

            <Pressable
              onPress={() => setUnreadOnly((v) => !v)}
              role="switch"
              aria-checked={unreadOnly}
              accessibilityLabel={t("admin.notifications.unreadOnlyLabel")}
              accessibilityState={{ checked: unreadOnly }}
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
                {t("admin.notifications.filterUnread")}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <View style={[styles.emptyIconRing, { borderColor }]}>
              <Icon name="warning-outline" size={28} color={mutedColor} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              {t("errors.generic")}
            </ThemedText>
            <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
              {t("admin.notifications.errorBody")}
            </ThemedText>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <View style={[styles.emptyIconRing, { borderColor }]}>
              <Icon
                name={unreadOnly ? "checkmark-circle-outline" : "notifications-off-outline"}
                size={28}
                color={mutedColor}
              />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
              {unreadOnly
                ? t("admin.notifications.allCaughtUpTitle")
                : t("admin.notifications.emptyTitle")}
            </ThemedText>
            <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
              {unreadOnly
                ? t("admin.notifications.allCaughtUpBody")
                : t("admin.notifications.emptyBody")}
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.listCard, { backgroundColor: cardBg, borderColor }]}>
            {pinnedItems.length > 0 && (
              <>
                <View style={[styles.sectionDivider, { borderBottomColor: borderColor }]}>
                  <Icon name="bookmark" size={11} color={primaryColor} />
                  <ThemedText style={[styles.sectionLabel, { color: primaryColor }]}>
                    {t("admin.notifications.pinnedLabel")}
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
                      {t("admin.notifications.allNotificationsLabel")}
                    </ThemedText>
                  </View>
                )}
              </>
            )}

            {unpinnedItems.map((n, i) => renderRow(n, i, unpinnedItems, false))}

            {hasMore && (
              <Button
                variant="ghost"
                tone="neutral"
                size="md"
                fullWidth
                style={[styles.loadMoreBtn, { borderTopColor: borderColor }]}
                onPress={handleLoadMore}
                disabled={loadingMore}
                loading={loadingMore}
                accessibilityLabel={t("admin.notifications.showMoreLabel", {
                  count: totalCount - items.length,
                })}
              >
                {loadingMore
                  ? t("admin.notifications.loadingMore")
                  : t("admin.notifications.showMoreButton", { count: totalCount - items.length })}
              </Button>
            )}
          </View>
        )}

        <BookingDetailPopup bookingId={popupBookingId} onClose={() => setPopupBookingId(null)} />
      </ScrollView>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Icon name="checkmark-circle-outline" size={15} color="#fff" />
          <ThemedText style={styles.toastText}>{toast}</ThemedText>
        </View>
      )}

      <ConfirmModal
        visible={confirmDeleteAll}
        title={t("admin.notifications.deleteAllModal.title")}
        message={t("admin.notifications.deleteAllModal.message")}
        confirmLabel={t("admin.notifications.deleteAllModal.confirmLabel")}
        destructive
        onConfirm={() => {
          setConfirmDeleteAll(false);
          deleteAllUnpinnedVisible();
        }}
        onCancel={() => setConfirmDeleteAll(false)}
      />
      <ConfirmModal
        visible={confirmDeleteId != null}
        title={t("admin.notifications.deletePinnedModal.title")}
        message={t("admin.notifications.deletePinnedModal.message")}
        confirmLabel={t("admin.notifications.deletePinnedModal.confirmLabel")}
        destructive
        onConfirm={handleConfirmedDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </View>
  );
}
