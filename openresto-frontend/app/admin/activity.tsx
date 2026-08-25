import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAuth, useCan } from "@/context/AuthContext";
import Button from "@/components/common/Button";
import PageLoader from "@/components/common/PageLoader";
import Select, { type SelectOption } from "@/components/common/Select";
import { Icon } from "@/components/common/Icon";
import { fetchRestaurants } from "@/api/restaurants";
import { adminListUsers } from "@/api/users";
import { getAuditEntries, type AdminAuditEntryDto } from "@/api/audit";
import {
  ANY_ID,
  PAGE_SIZE,
  fromIdFilter,
  getActionGroups,
  personLabel,
  toIdFilter,
} from "@/utils/audit";
import { ActivityRow } from "@/components/admin/activity/ActivityRow";
import { styles } from "@/styles/admin/activity.styles";

/**
 * The Owner-only activity trail. The API refuses a Manager outright, so the route is a dead
 * end rather than a disabled screen; the sidebar hides the entry too, and this catches a
 * typed-in URL. An unresolved session carries no role yet, which is why the loader comes
 * before the verdict.
 *
 * @see [activity.test.tsx](../../tests/app/admin/activity.test.tsx) — pins that an Owner
 * gets the trail, a Manager is bounced without a query reaching the API, and a session still
 * resolving holds on the loader instead of being treated as roleless.
 */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const { colors, primaryColor } = useAppTheme();
  const { status } = useAuth();
  const canViewAudit = useCan("view:audit");
  const resolved = status !== "loading";
  const allowed = resolved && canViewAudit;

  const [restaurants, setRestaurants] = useState<{ id: number; name: string }[]>([]);
  const [actors, setActors] = useState<{ id: number; name: string }[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = usePersistedState<number | null>(
    "activity:restaurantId",
    null
  );
  const [selectedAction, setSelectedAction] = usePersistedState<string>("activity:action", "");
  const [selectedActorId, setSelectedActorId] = usePersistedState<number | null>(
    "activity:actorUserId",
    null
  );

  const [items, setItems] = useState<AdminAuditEntryDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!allowed) return;
    fetchRestaurants().then(setRestaurants);
    adminListUsers().then((users) => {
      if (users)
        setActors(users.map((u) => ({ id: u.id, name: personLabel(u.displayName, u.email) })));
    });
  }, [allowed]);

  const loadPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(false);
      const result = await getAuditEntries({
        restaurantId: selectedRestaurantId ?? undefined,
        action: selectedAction || undefined,
        actorUserId: selectedActorId ?? undefined,
        page: pageNum,
        pageSize: PAGE_SIZE,
      });
      if (replace) setLoading(false);
      else setLoadingMore(false);
      if (!result) {
        setError(true);
        return;
      }
      if (replace) setItems(result.items);
      else setItems((prev) => [...prev, ...result.items]);
      setTotalCount(result.totalCount ?? 0);
    },
    [selectedRestaurantId, selectedAction, selectedActorId]
  );

  useEffect(() => {
    if (!allowed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
    loadPage(1, true);
  }, [allowed, loadPage]);

  if (!resolved) return <PageLoader />;
  if (!canViewAudit) return <Redirect href="/admin/dashboard" />;

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage, false);
  };

  const toggleExpanded = (id: number) => setExpandedId((prev) => (prev === id ? null : id));

  const hasMore = items.length < totalCount;
  const filtered = selectedRestaurantId != null || selectedAction !== "" || selectedActorId != null;

  const borderColor = colors.border;
  const mutedColor = colors.muted;

  const locationOptions: SelectOption[] = [
    { label: t("admin.activity.filters.allLocations"), value: ANY_ID },
    ...restaurants.map((r) => ({ label: r.name, value: r.id })),
  ];

  const actionOptions: SelectOption[] = getActionGroups(t);

  const personOptions: SelectOption[] = [
    { label: t("admin.activity.filters.anyone"), value: ANY_ID },
    ...actors.map((a) => ({ label: a.name, value: a.id })),
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: t("admin.activity.title") }} />}

      <View style={styles.pageHeader}>
        <ThemedText type="h1">{t("admin.activity.title")}</ThemedText>
        <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
          {loading
            ? t("common.status.loading")
            : t("admin.activity.eventCount", { count: totalCount })}
        </ThemedText>
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filterControl}>
          <Select
            icon="storefront-outline"
            accessibilityLabel={t("admin.activity.filters.locationLabel")}
            options={locationOptions}
            selectedValue={toIdFilter(selectedRestaurantId)}
            onSelect={(value) => setSelectedRestaurantId(fromIdFilter(value))}
          />
        </View>
        <View style={styles.filterControl}>
          <Select
            icon="pricetags-outline"
            accessibilityLabel={t("admin.activity.filters.activityLabel")}
            options={actionOptions}
            selectedValue={selectedAction}
            onSelect={(value) => setSelectedAction(String(value))}
          />
        </View>
        <View style={styles.filterControl}>
          <Select
            icon="person-outline"
            accessibilityLabel={t("admin.activity.filters.personLabel")}
            options={personOptions}
            selectedValue={toIdFilter(selectedActorId)}
            onSelect={(value) => setSelectedActorId(fromIdFilter(value))}
          />
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
            {t("admin.activity.error.title")}
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
            {t("admin.activity.error.body")}
          </ThemedText>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconRing, { borderColor }]}>
            <Icon name="receipt-outline" size={28} color={mutedColor} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
            {filtered
              ? t("admin.activity.empty.filteredTitle")
              : t("admin.activity.empty.noneYetTitle")}
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
            {filtered
              ? t("admin.activity.empty.filteredBody")
              : t("admin.activity.empty.noneYetBody")}
          </ThemedText>
        </View>
      ) : (
        <View
          testID="activity-list"
          style={[styles.listCard, { backgroundColor: colors.card, borderColor }]}
        >
          {items.map((entry, index) => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={toggleExpanded}
              isLast={index === items.length - 1 && !hasMore}
              borderColor={borderColor}
              cardBg={colors.card}
              detailBg={colors.surfaceAlt}
              mutedColor={mutedColor}
              textColor={colors.text}
            />
          ))}

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
              accessibilityLabel={t("admin.activity.loadMore.accessibilityLabel", {
                count: totalCount - items.length,
              })}
            >
              {loadingMore
                ? t("common.status.loading")
                : t("admin.activity.loadMore.action", { count: totalCount - items.length })}
            </Button>
          )}
        </View>
      )}
    </ScrollView>
  );
}
