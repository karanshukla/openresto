import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View, Platform } from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Button from "@/components/common/Button";
import { fetchRestaurants, createRestaurant, RestaurantDto } from "@/api/restaurants";
import {
  adminGetRestaurants,
  adminSetRestaurantArchived,
  pauseRestaurantBookings,
  unpauseRestaurantBookings,
  extendRestaurantBookings,
  AdminRestaurantSummary,
  BookingDetailDto,
} from "@/api/admin";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useCan } from "@/context/AuthContext";

import { LocationCard } from "@/components/admin/settings/LocationCard";
import { AddLocationForm } from "@/components/admin/locations/AddLocationForm";
import { LocationPills } from "@/components/admin/locations/LocationPills";
import { ArchiveLocationRow } from "@/components/admin/locations/ArchiveLocationRow";
import { ArchivedLocationPanel } from "@/components/admin/locations/ArchivedLocationPanel";
import { styles } from "@/components/admin/settings/settings.styles";
import { Icon } from "@/components/common/Icon";

function locationCountSummary(activeCount: number, archivedCount: number): string {
  if (activeCount + archivedCount === 0) return "No locations configured";
  const active = `${activeCount} active`;
  return archivedCount > 0 ? `${active} · ${archivedCount} archived` : active;
}

export default function AdminLocationsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [persistedSelectedId, setPersistedSelectedId] = usePersistedState<number | null>(
    "locations:selectedId",
    null
  );
  const [loading, setLoading] = useState(true);
  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [allRestaurants, setAllRestaurants] = useState<AdminRestaurantSummary[]>([]);
  const [pausing, setPausing] = useState(false);
  const [extending, setExtending] = useState(false);
  const [extendedBookings, setExtendedBookings] = useState<BookingDetailDto[] | null>(null);
  const [extendNoActive, setExtendNoActive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveFailed, setArchiveFailed] = useState(false);
  const [deletedName, setDeletedName] = useState<string | null>(null);

  const { colors, isDark, primaryColor } = useAppTheme();
  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;
  const canDeleteLocation = useCan("delete:location");

  function patchRestaurant(id: number, patch: Partial<RestaurantDto>) {
    setRestaurants((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // The pills read the admin list, so a rename has to reach it or the selector keeps
    // showing the old name until the next load.
    if (patch.name !== undefined) {
      setAllRestaurants((prev) =>
        prev.map((r) => (r.id === id ? { ...r, name: patch.name as string } : r))
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRestaurants(), adminGetRestaurants()]).then(([active, all]) => {
      if (cancelled) return;
      setRestaurants(active);
      const persistedMatch =
        persistedSelectedId != null ? all.find((r) => r.id === persistedSelectedId) : undefined;
      const nextId = persistedMatch ? persistedMatch.id : (all[0]?.id ?? null);
      if (nextId !== null) setSelectedId(nextId);
      setPersistedSelectedId(nextId);
      setAllRestaurants(all);
      setLoading(false);
    });
    /* istanbul ignore next */
    return () => {
      cancelled = true;
    };
    // persistedSelectedId seeds the initial selection only; omitting it avoids a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedSummary = allRestaurants.find((r) => r.id === selectedId) ?? null;
  const isArchived = selectedSummary?.isArchived ?? false;
  // Archived locations are absent from the editable list, so this is null for them by design.
  const selectedRestaurant = isArchived
    ? null
    : (restaurants.find((r) => r.id === selectedId) ?? null);
  const activeCount = selectedSummary?.activeBookingsCount ?? 0;
  const isPaused = selectedSummary?.bookingsPausedUntil
    ? new Date(selectedSummary.bookingsPausedUntil) > new Date()
    : false;
  const pausedUntilText =
    isPaused && selectedSummary?.bookingsPausedUntil
      ? new Date(selectedSummary.bookingsPausedUntil).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;
  const archivedCount = allRestaurants.filter((r) => r.isArchived).length;

  const selectAndRemember = (id: number | null) => {
    setSelectedId(id);
    setPersistedSelectedId(id);
  };

  function handleSelectLocation(id: number) {
    selectAndRemember(id);
    setExtendedBookings(null);
    setExtendNoActive(false);
    setArchiveFailed(false);
    setDeletedName(null);
  }

  async function handleSetArchived(id: number, archived: boolean) {
    setArchiving(true);
    setArchiveFailed(false);
    const ok = await adminSetRestaurantArchived(id, archived);
    if (!ok) {
      setArchiving(false);
      setArchiveFailed(true);
      return;
    }
    setAllRestaurants((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isArchived: archived } : r))
    );
    // The editable list is active-only, so both directions need it back from the server:
    // archiving drops the row, restoring brings back a record this screen never held.
    const active = await fetchRestaurants();
    setRestaurants(active);
    setArchiving(false);
  }

  function handleDeleted(id: number) {
    const deleted = allRestaurants.find((r) => r.id === id);
    const remaining = allRestaurants.filter((r) => r.id !== id);
    setAllRestaurants(remaining);
    setRestaurants((prev) => prev.filter((r) => r.id !== id));
    selectAndRemember(remaining.length > 0 ? remaining[0].id : null);
    setDeletedName(deleted?.name ?? null);
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={primaryColor} />
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Locations" }} />}

      <View style={styles.pageHeader}>
        <View style={{ gap: 2 }}>
          <ThemedText type="h1">Locations</ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {locationCountSummary(allRestaurants.length - archivedCount, archivedCount)}
          </ThemedText>
        </View>
        <Button
          size="md"
          icon="add"
          onPress={() => setAddingLocation(true)}
          disabled={addingLocation}
          accessibilityLabel="Add location"
        >
          Add location
        </Button>
      </View>

      {deletedName && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="checkmark-circle-outline" size="lg" color={colors.success} />
          <ThemedText style={{ fontSize: 13, color: mutedColor }}>
            {deletedName} was permanently deleted.
          </ThemedText>
        </View>
      )}

      {addingLocation && (
        <AddLocationForm
          value={newLocationName}
          saving={savingLocation}
          isDark={isDark}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
          onValueChange={setNewLocationName}
          onSubmit={async () => {
            if (!newLocationName.trim()) return;
            setSavingLocation(true);
            const created = await createRestaurant(newLocationName.trim());
            setSavingLocation(false);
            if (created) {
              setRestaurants((prev) => [...prev, { ...created, sections: [] }]);
              setAllRestaurants((prev) => [...prev, { id: created.id, name: created.name }]);
              selectAndRemember(created.id);
            }
            setNewLocationName("");
            setAddingLocation(false);
          }}
          onCancel={() => {
            setAddingLocation(false);
            setNewLocationName("");
          }}
        />
      )}

      {allRestaurants.length > 0 && (
        <LocationPills
          restaurants={allRestaurants}
          selectedId={selectedId}
          onSelect={handleSelectLocation}
        />
      )}

      {selectedRestaurant && (
        <View style={styles.bulkActions}>
          <Button
            variant="secondary"
            tone={isPaused ? "success" : "warning"}
            size="md"
            style={styles.bulkAction}
            icon={isPaused ? "play-circle-outline" : "pause-circle-outline"}
            disabled={pausing}
            loading={pausing}
            accessibilityLabel={
              isPaused
                ? `Resume bookings for ${selectedRestaurant.name}`
                : `Pause the next hour of bookings at ${selectedRestaurant.name}`
            }
            onPress={async () => {
              setPausing(true);
              if (isPaused) {
                await unpauseRestaurantBookings(selectedRestaurant.id);
                setAllRestaurants((prev) =>
                  prev.map((r) =>
                    r.id === selectedRestaurant.id ? { ...r, bookingsPausedUntil: undefined } : r
                  )
                );
              } else {
                await pauseRestaurantBookings(selectedRestaurant.id, 60);
                setAllRestaurants((prev) =>
                  prev.map((r) =>
                    r.id === selectedRestaurant.id
                      ? {
                          ...r,
                          bookingsPausedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        }
                      : r
                  )
                );
              }
              setPausing(false);
            }}
          >
            {pausing
              ? "Saving…"
              : isPaused
                ? `Resume New Bookings now (paused up to ${pausedUntilText})`
                : "Pause New Bookings for the next 60m"}
          </Button>

          <Button
            variant="secondary"
            size="md"
            style={styles.bulkAction}
            icon="timer-outline"
            disabled={extending || extendedBookings !== null || extendNoActive || activeCount === 0}
            loading={extending}
            accessibilityLabel={`Extend all active bookings at ${selectedRestaurant.name} by an hour`}
            onPress={async () => {
              setExtending(true);
              const result = await extendRestaurantBookings(selectedRestaurant.id, 60);
              setExtending(false);
              if (result.ok) {
                if (result.extendedBookings.length > 0) {
                  setExtendedBookings(result.extendedBookings);
                } else {
                  setExtendNoActive(true);
                }
              }
            }}
          >
            {extending
              ? "Extending…"
              : extendedBookings !== null
                ? `Extended ${extendedBookings.length} active bookings +60m`
                : extendNoActive
                  ? "No active bookings to extend"
                  : activeCount > 0
                    ? `Extend ${activeCount} active Bookings by 60m`
                    : "No active bookings"}
          </Button>
        </View>
      )}

      {allRestaurants.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 72,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 1,
              borderColor,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 4,
            }}
          >
            <Icon name="storefront-outline" size={28} color={mutedColor} />
          </View>
          <ThemedText style={{ fontSize: 16, fontWeight: "700", textAlign: "center" }}>
            No locations yet
          </ThemedText>
          <ThemedText
            style={{
              fontSize: 14,
              color: mutedColor,
              textAlign: "center",
              maxWidth: 280,
              lineHeight: 22,
            }}
          >
            Add your first location to start accepting bookings.
          </ThemedText>
        </View>
      ) : selectedSummary && isArchived ? (
        <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
          <ArchivedLocationPanel
            id={selectedSummary.id}
            name={selectedSummary.name}
            restoring={archiving}
            restoreFailed={archiveFailed}
            onRestore={() => handleSetArchived(selectedSummary.id, false)}
            canDelete={canDeleteLocation}
            onDeleted={handleDeleted}
          />
        </View>
      ) : selectedRestaurant ? (
        <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
          <LocationCard
            key={selectedRestaurant.id}
            restaurant={selectedRestaurant}
            onSaved={(patch) => patchRestaurant(selectedRestaurant.id, patch)}
            isDark={isDark}
            borderColor={borderColor}
            mutedColor={mutedColor}
          />
          <ArchiveLocationRow
            name={selectedRestaurant.name}
            upcomingBookingsCount={selectedSummary?.upcomingBookingsCount ?? 0}
            archiving={archiving}
            failed={archiveFailed}
            onArchive={() => handleSetArchived(selectedRestaurant.id, true)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
