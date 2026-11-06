import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ConfirmModal from "@/components/common/ConfirmModal";
import { Icon } from "@/components/common/Icon";
import { LocationPills } from "@/components/admin/locations/LocationPills";
import WaitlistRow, { waitlistPartyName } from "@/components/admin/waitlist/WaitlistRow";
import { FloorTile } from "@/components/admin/tonight/FloorTile";
import { ArrivalRow } from "@/components/admin/tonight/ArrivalRow";
import { UndoBar } from "@/components/admin/tonight/UndoBar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { theme } from "@/theme/theme";
import { fetchRestaurants } from "@/api/restaurants";
import { adminSetBookingStatus, type BookingDetailDto, type BookingStatus } from "@/api/admin";
import { actOnWaitlistEntry, type WaitlistEntry } from "@/api/waitlist";
import {
  getTonight,
  moveBookingToTable,
  seatWaitlistEntryAt,
  type FloorUnit,
  type Tonight,
} from "@/api/tonight";
import { fmtTime } from "@/utils/formatters";
import {
  floorCounts,
  groupArrivals,
  isAwaitingTable,
  tileFit,
  type SeatingSource,
} from "@/utils/tonight";
import {
  styles,
  THREE_COLUMN_MIN_WIDTH,
  TWO_COLUMN_MIN_WIDTH,
} from "@/styles/admin/tonight.styles";

/** How often the floor re-reads, matching the waitlist board. */
export const TONIGHT_POLL_MS = 15_000;

type Pane = "floor" | "arrivals" | "waitlist";
type Layout = "three" | "two" | "one";
type Picked = SeatingSource & { name: string };
type Done = { message: string; undo?: { bookingId: number; status: BookingStatus } };

function layoutFor(width: number): Layout {
  if (width >= THREE_COLUMN_MIN_WIDTH) return "three";
  if (width >= TWO_COLUMN_MIN_WIDTH) return "two";
  return "one";
}

/**
 * The host stand: what's free, who is due, who is waiting, on one tablet screen. Tap a party
 * (Choose table) and then a tile (Seat here) to place them; every move is one press followed by
 * an undo rather than a confirm. Removing a waitlist party keeps its confirm, because nothing
 * can bring the entry back.
 *
 * @see [tonight.test.tsx](../../tests/app/admin/tonight.test.tsx) — pins the poll, each tile
 * and arrival move, seating a waitlist party on a chosen tile, moving a booking to another
 * table, undo, and the columns collapsing to tabs on a narrow screen.
 */
export default function TonightScreen() {
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  const viewport = useWindowDimensions();

  const [restaurants, setRestaurants] = useState<{ id: number; name: string }[] | null>(null);
  const [restaurantId, setRestaurantId] = usePersistedState<number | null>(
    "tonight:restaurantId",
    null
  );
  const [data, setData] = useState<Tonight | null | undefined>(undefined);
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [width, setWidth] = useState(viewport.width);
  const [tab, setTab] = useState<Pane>("floor");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WaitlistEntry | null>(null);

  useEffect(() => {
    fetchRestaurants().then(setRestaurants);
  }, []);

  const selectedId =
    restaurants?.find((r) => r.id === restaurantId)?.id ?? restaurants?.[0]?.id ?? null;

  const refresh = useCallback(async () => {
    if (selectedId == null) return;
    const next = await getTonight(selectedId);
    if (next) {
      setClockOffset(new Date(next.now).getTime() - Date.now());
      setFetchedAt(Date.now());
      setData(next);
      setStale(false);
    } else {
      // A failed poll mid-service keeps the last floor on screen rather than blanking it.
      setData((previous) => (previous ? previous : null));
      setStale(true);
    }
  }, [selectedId]);

  useEffect(() => {
    setData(undefined);
    setPicked(null);
    refresh();
    const timer = setInterval(refresh, TONIGHT_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Escape puts the picked party back down, the way it would close any other picker.
  useEffect(() => {
    if (Platform.OS !== "web" || !picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicked(null);
    };
    window.addEventListener?.("keydown", onKey);
    return () => window.removeEventListener?.("keydown", onKey);
  }, [picked]);

  const nowMs = Date.now() + clockOffset;
  const layout = layoutFor(width);
  const bookingsById = useMemo(() => new Map((data?.bookings ?? []).map((b) => [b.id, b])), [data]);
  const tableUnits = useMemo(() => data?.sections.flatMap((s) => s.units) ?? [], [data]);
  const arrivals = data ? groupArrivals(data.bookings, nowMs) : [];
  const arrivalsCount = arrivals.reduce((sum, g) => sum + g.bookings.length, 0);
  const entries = data?.waitlist.entries ?? [];

  // A party someone else has already seated, or who left the queue, is no longer in hand.
  useEffect(() => {
    if (!picked || !data) return;
    const stillThere =
      picked.kind === "booking"
        ? (() => {
            const b = data.bookings.find((x) => x.id === picked.id);
            return !!b && isAwaitingTable(b);
          })()
        : data.waitlist.entries.some((e) => e.id === picked.id);
    if (!stillThere) setPicked(null);
  }, [data, picked]);

  const unitLabel = (unit: FloorUnit) =>
    unit.name || t("admin.tonight.tile.tableFallback", { id: unit.id });
  const guestName = (b: BookingDetailDto) => b.customerName || t("admin.tonight.party.hidden");

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const doneMessage = (status: BookingStatus, booking: BookingDetailDto, table: string) => {
    switch (status) {
      case "Arrived":
        return t("admin.tonight.done.arrived", { name: guestName(booking) });
      case "Finished":
        return t("admin.tonight.done.finished", { table });
      case "NoShow":
        return t("admin.tonight.done.noShow", { name: guestName(booking) });
      default:
        return t("admin.tonight.done.seated", { name: guestName(booking), table });
    }
  };

  const applyStatus = async (booking: BookingDetailDto, status: BookingStatus, table?: string) => {
    const updated = await adminSetBookingStatus(booking.id, status);
    setDone({
      message: doneMessage(status, booking, table ?? booking.tableName),
      undo: updated.undoStatus ? { bookingId: booking.id, status: updated.undoStatus } : undefined,
    });
  };

  const setStatus = (booking: BookingDetailDto, status: BookingStatus, table?: string) =>
    run(() => applyStatus(booking, status, table));

  const seatHere = (unit: FloorUnit) => {
    /* istanbul ignore next -- Seat here only renders while a party is picked */
    if (!picked) return;
    const source = picked;
    const label = unitLabel(unit);
    setPicked(null);
    return run(async () => {
      if (source.kind === "waitlist") {
        const result = await seatWaitlistEntryAt(source.id, unit);
        if (!result.ok) throw new Error(result.message);
        setDone({ message: t("admin.tonight.done.seated", { name: source.name, table: label }) });
        return;
      }
      const booking = bookingsById.get(source.id);
      /* istanbul ignore next -- a picked booking leaves `picked` as soon as it leaves the data */
      if (!booking) return;
      if (tileFit(unit, source) !== "own") {
        const moved = await moveBookingToTable(booking.id, unit.id);
        if (!moved.ok) throw new Error(moved.message);
      }
      await applyStatus(booking, "Seated", label);
    });
  };

  const undo = () => {
    const target = done?.undo;
    /* istanbul ignore next -- Undo only renders with a move to take back */
    if (!target) return;
    return run(async () => {
      await adminSetBookingStatus(target.bookingId, target.status);
      setDone({ message: t("admin.tonight.done.undone") });
    });
  };

  const actOnEntry = (entry: WaitlistEntry, action: "notify" | "seat" | "remove") =>
    run(async () => {
      const result = await actOnWaitlistEntry(entry.id, action);
      if (!result.ok) throw new Error(result.message);
    });

  const choose = (source: Picked) => {
    const same = picked?.kind === source.kind && picked.id === source.id;
    setPicked(same ? null : source);
    if (!same && layout === "one") setTab("floor");
  };

  const dismissDone = useCallback(() => setDone(null), []);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // ── Panes ──────────────────────────────────────────────────────────────────

  const emptyState = (icon: "people-outline" | "time-outline", title: string, body: string) => (
    <View style={styles.empty}>
      <Icon name={icon} size={28} color={colors.muted} />
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText style={[styles.emptyBody, { color: colors.muted }]}>{body}</ThemedText>
    </View>
  );

  const pickBanner = () =>
    picked && (
      <View
        testID="pick-banner"
        role="status"
        accessibilityLiveRegion="polite"
        style={[styles.pickBanner, { borderColor: primaryColor, backgroundColor: colors.card }]}
      >
        <Icon name="grid-outline" size="lg" color={primaryColor} />
        <View style={styles.pickText}>
          <ThemedText style={styles.pickTitle}>
            {t("admin.tonight.pick.title", {
              name: picked.name,
              guests: t("admin.tonight.party.guests", { count: picked.seats }),
            })}
          </ThemedText>
          <ThemedText style={[styles.pickHint, { color: colors.muted }]}>
            {t("admin.tonight.pick.hint")}
          </ThemedText>
        </View>
        <Button
          size="md"
          variant="secondary"
          tone="neutral"
          onPress={() => setPicked(null)}
          testID="pick-cancel"
        >
          {t("admin.tonight.pick.cancel")}
        </Button>
      </View>
    );

  const tile = (unit: FloorUnit) => (
    <FloorTile
      key={`${unit.kind}-${unit.id}`}
      unit={unit}
      label={unitLabel(unit)}
      current={unit.currentBookingId != null ? bookingsById.get(unit.currentBookingId) : undefined}
      next={unit.nextBookingId != null ? bookingsById.get(unit.nextBookingId) : undefined}
      nowMs={nowMs}
      timezone={data!.timezone}
      pick={picked ? { fit: tileFit(unit, picked), partyName: picked.name } : null}
      busy={busy}
      onSetStatus={(booking, status) => setStatus(booking, status, unitLabel(unit))}
      onSeatHere={() => seatHere(unit)}
    />
  );

  const floorPane = () => (
    <ScrollView contentContainerStyle={styles.floorBody} testID="pane-floor">
      {pickBanner()}
      {data!.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>
            {section.name}
          </ThemedText>
          <View style={styles.tiles}>{section.units.map(tile)}</View>
        </View>
      ))}
      {data!.groups.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>
            {t("admin.tonight.tile.combined")}
          </ThemedText>
          <View style={styles.tiles}>{data!.groups.map(tile)}</View>
        </View>
      )}
    </ScrollView>
  );

  const ownTableFree = (booking: BookingDetailDto) => {
    const unit =
      booking.tableGroupId != null
        ? data!.groups.find((g) => g.id === booking.tableGroupId)
        : tableUnits.find((u) => u.id === booking.tableId);
    return !!unit && (unit.state === "free" || unit.state === "bookedSoon");
  };

  const lateTone = isDark ? theme.floor.overdue.text.dark : theme.floor.overdue.text.light;

  const arrivalsPane = () => (
    <ScrollView contentContainerStyle={styles.paneBody} testID="pane-arrivals">
      {arrivals.length === 0
        ? emptyState(
            "time-outline",
            t("admin.tonight.arrivals.empty"),
            t("admin.tonight.arrivals.emptyBody")
          )
        : arrivals.map((group) => (
            <View key={group.key} testID={`arrivals-${group.key}`}>
              <ThemedText
                style={[
                  styles.sectionLabel,
                  styles.groupHeading,
                  { color: group.key === "late" ? lateTone : colors.muted },
                ]}
              >
                {t(`admin.tonight.arrivals.groups.${group.key}`)} · {group.bookings.length}
              </ThemedText>
              {group.bookings.map((booking, index) => (
                <ArrivalRow
                  key={booking.id}
                  booking={booking}
                  nowMs={nowMs}
                  timezone={data!.timezone}
                  choosing={picked?.kind === "booking" && picked.id === booking.id}
                  ownTableFree={ownTableFree(booking)}
                  busy={busy}
                  isLast={index === group.bookings.length - 1}
                  onSetStatus={(status) => setStatus(booking, status)}
                  onChooseTable={() =>
                    choose({
                      kind: "booking",
                      id: booking.id,
                      seats: booking.seats,
                      tableId: booking.tableId,
                      isGroupBooking: booking.tableGroupId != null,
                      name: guestName(booking),
                    })
                  }
                />
              ))}
            </View>
          ))}
    </ScrollView>
  );

  const waitlistPane = () => (
    <ScrollView contentContainerStyle={styles.paneBody} testID="pane-waitlist">
      {entries.length === 0
        ? emptyState(
            "people-outline",
            t("admin.tonight.waitlist.empty"),
            t("admin.tonight.waitlist.emptyBody")
          )
        : entries.map((entry, index) => (
            <WaitlistRow
              key={entry.id}
              entry={entry}
              busy={busy}
              isLast={index === entries.length - 1}
              choosing={picked?.kind === "waitlist" && picked.id === entry.id}
              onChooseTable={() =>
                choose({
                  kind: "waitlist",
                  id: entry.id,
                  seats: entry.seats,
                  seatable: data!.seatableNow.find((x) => x.seats === entry.seats),
                  name: waitlistPartyName(entry, t),
                })
              }
              onAction={(action) =>
                action === "remove" ? setRemoveTarget(entry) : actOnEntry(entry, action)
              }
            />
          ))}
    </ScrollView>
  );

  const paneTitles: Record<Pane, string> = {
    floor: t("admin.tonight.columns.floor"),
    arrivals: t("admin.tonight.columns.arrivals"),
    waitlist: t("admin.tonight.columns.waitlist"),
  };
  const paneCounts: Record<Pane, number | null> = {
    floor: null,
    arrivals: arrivalsCount,
    waitlist: entries.length,
  };
  const paneContent: Record<Pane, () => React.ReactNode> = {
    floor: floorPane,
    arrivals: arrivalsPane,
    waitlist: waitlistPane,
  };

  const countBadge = (count: number | null, active = false) =>
    count === null ? null : (
      <View style={[styles.count, { backgroundColor: active ? primaryColor : colors.surfaceAlt }]}>
        <ThemedText style={[styles.countText, { color: active ? "#fff" : colors.muted }]}>
          {count}
        </ThemedText>
      </View>
    );

  const pane = (key: Pane) => (
    <View style={[styles.pane, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.paneHeader, { borderBottomColor: colors.border }]}>
        <ThemedText style={styles.paneTitle} role="heading">
          {paneTitles[key]}
        </ThemedText>
        {countBadge(paneCounts[key])}
      </View>
      {paneContent[key]()}
    </View>
  );

  const tabbedPane = (tabs: Pane[]) => {
    const active = tabs.includes(tab) ? tab : tabs[0];
    return (
      <View style={[styles.pane, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View
          style={[styles.tabs, { borderBottomColor: colors.border }]}
          role="tablist"
          accessibilityLabel={t("admin.tonight.columns.label")}
        >
          {tabs.map((key) => {
            const selected = key === active;
            return (
              <Pressable
                key={key}
                role="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(key)}
                testID={`tab-${key}`}
                style={[styles.tab, selected && { borderBottomColor: primaryColor }]}
              >
                <ThemedText
                  style={[styles.tabText, { color: selected ? colors.text : colors.muted }]}
                >
                  {paneTitles[key]}
                </ThemedText>
                {countBadge(paneCounts[key], selected)}
              </Pressable>
            );
          })}
        </View>
        {paneContent[active]()}
      </View>
    );
  };

  const counts = floorCounts(tableUnits);
  const summaryChip = (
    key: "free" | "seated" | "overdue" | "waiting",
    count: number,
    dot: string
  ) => (
    <View key={key} style={[styles.summaryChip, { backgroundColor: colors.surfaceAlt }]}>
      <View style={[styles.summaryDot, { backgroundColor: dot }]} />
      <ThemedText style={styles.summaryText} testID={`summary-${key}`}>
        {t(`admin.tonight.summary.${key}`, { count })}
      </ThemedText>
    </View>
  );
  const toneText = (state: "free" | "seated" | "overdue") =>
    isDark ? theme.floor[state].text.dark : theme.floor[state].text.light;

  return (
    <View style={styles.screen} onLayout={onLayout} testID="tonight-screen">
      {Platform.OS !== "web" && <Stack.Screen options={{ title: t("admin.tonight.title") }} />}

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <ThemedText type="h1">{t("admin.tonight.title")}</ThemedText>
          {fetchedAt !== null && (
            <ThemedText
              testID="tonight-updated"
              style={[styles.updated, { color: stale ? colors.error : colors.muted }]}
            >
              {stale ? t("admin.tonight.loadFailed") + " " : ""}
              {t("admin.tonight.updated", { time: fmtTime(new Date(fetchedAt)) })}
            </ThemedText>
          )}
        </View>
        {restaurants && restaurants.length > 1 && (
          <LocationPills
            restaurants={restaurants}
            selectedId={selectedId}
            onSelect={setRestaurantId}
          />
        )}
        {data && (
          <View style={styles.summary}>
            {summaryChip("free", counts.free, toneText("free"))}
            {summaryChip("seated", counts.seated, toneText("seated"))}
            {counts.overdue > 0 && summaryChip("overdue", counts.overdue, toneText("overdue"))}
            {summaryChip("waiting", entries.length, primaryColor)}
          </View>
        )}
        {error && (
          <ThemedText
            testID="tonight-error"
            style={[styles.error, { color: colors.error }]}
            role="alert"
            accessibilityLiveRegion="assertive"
          >
            {error}
          </ThemedText>
        )}
      </View>

      {restaurants === null || (restaurants.length > 0 && data === undefined) ? (
        <View style={styles.center}>
          <ActivityIndicator testID="tonight-loading" size="large" color={primaryColor} />
        </View>
      ) : restaurants.length === 0 ? (
        <View style={styles.center}>
          <ThemedText style={{ color: colors.muted }}>{t("admin.tonight.noLocations")}</ThemedText>
        </View>
      ) : data === null ? (
        <View style={styles.center} role="alert">
          <Icon name="warning-outline" size={28} color={colors.muted} />
          <ThemedText style={{ color: colors.muted }}>{t("admin.tonight.loadFailed")}</ThemedText>
          <Button size="md" variant="secondary" icon="refresh" onPress={refresh}>
            {t("common.actions.tryAgain")}
          </Button>
        </View>
      ) : (
        <View style={styles.columns} testID={`tonight-layout-${layout}`}>
          {layout === "three" ? (
            <>
              <View style={styles.floorColumn}>{pane("floor")}</View>
              <View style={styles.column}>{pane("arrivals")}</View>
              <View style={styles.column}>{pane("waitlist")}</View>
            </>
          ) : layout === "two" ? (
            <>
              <View style={styles.floorColumn}>{pane("floor")}</View>
              <View style={styles.sideColumn}>{tabbedPane(["arrivals", "waitlist"])}</View>
            </>
          ) : (
            <View style={styles.floorColumn}>{tabbedPane(["floor", "arrivals", "waitlist"])}</View>
          )}
        </View>
      )}

      {done && (
        <UndoBar
          message={done.message}
          onUndo={done.undo ? undo : undefined}
          onDismiss={dismissDone}
        />
      )}

      <ConfirmModal
        visible={!!removeTarget}
        title={t("admin.waitlist.removeTitle")}
        message={
          removeTarget
            ? t("admin.waitlist.removeConfirm", { name: waitlistPartyName(removeTarget, t) })
            : ""
        }
        confirmLabel={t("admin.waitlist.remove")}
        destructive
        onConfirm={() => {
          /* istanbul ignore next -- the modal only confirms while a target is set */
          if (!removeTarget) return;
          const entry = removeTarget;
          setRemoveTarget(null);
          actOnEntry(entry, "remove");
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </View>
  );
}
