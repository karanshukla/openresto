import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAuth, useCan } from "@/context/AuthContext";
import { hexToRgba } from "@/utils/colors";
import Button from "@/components/common/Button";
import HorizontalScroller from "@/components/common/HorizontalScroller";
import PageLoader from "@/components/common/PageLoader";
import { Icon } from "@/components/common/Icon";
import { fetchRestaurants } from "@/api/restaurants";
import { adminListUsers } from "@/api/users";
import { getAuditEntries, type AdminAuditEntryDto } from "@/api/audit";
import { ACTION_GROUPS, PAGE_SIZE, personLabel } from "@/utils/audit";
import { ActivityRow } from "@/components/admin/activity/ActivityRow";
import { styles } from "@/styles/admin/activity.styles";

interface FilterOption {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterRow({
  label,
  options,
  borderColor,
  mutedColor,
  primaryColor,
}: {
  label: string;
  options: FilterOption[];
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
}) {
  return (
    <HorizontalScroller label={label} contentContainerStyle={styles.pillRow}>
      {options.map((option) => (
        <Pressable
          key={option.key}
          onPress={option.onPress}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: option.active }}
          style={[
            styles.pill,
            option.active
              ? { backgroundColor: hexToRgba(primaryColor, 0.12), borderColor: primaryColor }
              : { backgroundColor: "transparent", borderColor },
          ]}
        >
          <ThemedText
            style={[styles.pillText, { color: option.active ? primaryColor : mutedColor }]}
          >
            {option.label}
          </ThemedText>
        </Pressable>
      ))}
    </HorizontalScroller>
  );
}

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
  const palette = { borderColor, mutedColor, primaryColor };

  const locationOptions: FilterOption[] = [
    {
      key: "all",
      label: "All locations",
      active: selectedRestaurantId === null,
      onPress: () => setSelectedRestaurantId(null),
    },
    ...restaurants.map((r) => ({
      key: String(r.id),
      label: r.name,
      active: selectedRestaurantId === r.id,
      onPress: () => setSelectedRestaurantId(r.id),
    })),
  ];

  const actionOptions: FilterOption[] = ACTION_GROUPS.map((group) => ({
    key: group.value || "all",
    label: group.label,
    active: selectedAction === group.value,
    onPress: () => setSelectedAction(group.value),
  }));

  const actorOptions: FilterOption[] = [
    {
      key: "anyone",
      label: "Anyone",
      active: selectedActorId === null,
      onPress: () => setSelectedActorId(null),
    },
    ...actors.map((a) => ({
      key: String(a.id),
      label: a.name,
      active: selectedActorId === a.id,
      onPress: () => setSelectedActorId(a.id),
    })),
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Activity" }} />}

      <View style={styles.pageHeader}>
        <ThemedText type="h1">Activity</ThemedText>
        <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
          {loading ? "Loading…" : `${totalCount} recorded event${totalCount !== 1 ? "s" : ""}`}
        </ThemedText>
      </View>

      <View style={styles.filtersSection}>
        <FilterRow label="Locations" options={locationOptions} {...palette} />
        <FilterRow label="Activity types" options={actionOptions} {...palette} />
        <FilterRow label="People" options={actorOptions} {...palette} />
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
            Something went wrong
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
            Could not load the activity trail. Check your connection and try again.
          </ThemedText>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIconRing, { borderColor }]}>
            <Icon name="receipt-outline" size={28} color={mutedColor} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
            {filtered ? "Nothing matches these filters" : "No activity yet"}
          </ThemedText>
          <ThemedText style={[styles.emptyBody, { color: mutedColor }]}>
            {filtered
              ? "Try a wider location, activity type or person."
              : "Every admin action lands here as it happens."}
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
              accessibilityLabel={`Show ${totalCount - items.length} more events`}
            >
              {loadingMore ? "Loading…" : `Show ${totalCount - items.length} more`}
            </Button>
          )}
        </View>
      )}
    </ScrollView>
  );
}
