import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { usePersistedState } from "@/hooks/use-persisted-state";
import Select from "@/components/common/Select";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import WaitlistRow from "@/components/admin/waitlist/WaitlistRow";
import { fetchRestaurants } from "@/api/restaurants";
import {
  actOnWaitlistEntry,
  addWaitlistParty,
  getWaitlistBoard,
  type WaitlistBoard,
} from "@/api/waitlist";
import { isValidEmail } from "@/utils/validation";
import { styles } from "@/styles/admin/waitlist.styles";

/** How often the board re-reads the queue, so guests joining from the site appear without a reload. */
export const BOARD_POLL_MS = 15_000;

const PARTY_SIZES = 12;

/**
 * The host stand's view of the walk-in queue: who is waiting, the wait each is quoted, and
 * whether a table can take them this minute. Staff can add a party here on any day; guests
 * can only join from the site while the location is walk-in only and open.
 *
 * @see [waitlist.test.tsx](../../tests/app/admin/waitlist.test.tsx) — pins adding a party,
 * each row action, the refresh after an action, and the rejection message.
 */
export default function WaitlistScreen() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  const [restaurants, setRestaurants] = useState<{ id: number; name: string }[] | null>(null);
  const [restaurantId, setRestaurantId] = usePersistedState<number | null>(
    "waitlist:restaurantId",
    null
  );
  const [board, setBoard] = useState<WaitlistBoard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [seats, setSeats] = useState(2);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchRestaurants().then(setRestaurants);
  }, []);

  /** The remembered pick while it still exists, else the first location. */
  const selectedId =
    restaurants?.find((r) => r.id === restaurantId)?.id ?? restaurants?.[0]?.id ?? null;

  const refresh = useCallback(async () => {
    if (selectedId == null) return;
    setBoard(await getWaitlistBoard(selectedId));
  }, [selectedId]);

  useEffect(() => {
    setBoard(undefined);
    refresh();
    const timer = setInterval(refresh, BOARD_POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const act = async (id: number, action: "notify" | "seat" | "remove") => {
    setBusyId(id);
    setError(null);
    const result = await actOnWaitlistEntry(id, action);
    setBusyId(null);
    if (!result.ok) setError(result.message);
    await refresh();
  };

  const trimmedEmail = email.trim();
  const canAdd =
    !adding && name.trim().length > 0 && (trimmedEmail === "" || isValidEmail(trimmedEmail));

  const add = async () => {
    /* istanbul ignore next -- the form only renders once a location is selected */
    if (selectedId == null) return;
    setAdding(true);
    setError(null);
    const result = await addWaitlistParty(selectedId, {
      name: name.trim(),
      seats,
      email: trimmedEmail || undefined,
    });
    setAdding(false);
    if (result.ok) {
      setName("");
      setEmail("");
      setSeats(2);
      await refresh();
    } else {
      setError(result.message);
    }
  };

  const seatOptions = Array.from({ length: PARTY_SIZES }, (_, i) => ({
    label: t("admin.waitlist.guests", { count: i + 1 }),
    value: i + 1,
  }));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {Platform.OS !== "web" && <Stack.Screen options={{ title: t("admin.waitlist.title") }} />}

      <View style={styles.pageHeader}>
        <ThemedText type="h1">{t("admin.waitlist.title")}</ThemedText>
        {board && (
          <ThemedText style={[styles.pageSub, { color: colors.muted }]} testID="waitlist-accepting">
            {board.acceptingGuests
              ? t("admin.waitlist.accepting")
              : t("admin.waitlist.notAccepting")}
          </ThemedText>
        )}
      </View>

      {restaurants === null ? (
        <ActivityIndicator />
      ) : restaurants.length === 0 ? (
        <ThemedText style={{ color: colors.muted }}>{t("admin.waitlist.noLocations")}</ThemedText>
      ) : (
        <>
          <View style={styles.locationControl}>
            <Select
              icon="storefront-outline"
              accessibilityLabel={t("admin.waitlist.locationLabel")}
              options={restaurants.map((r) => ({ label: r.name, value: r.id }))}
              selectedValue={selectedId!}
              onSelect={(value) => setRestaurantId(Number(value))}
            />
          </View>

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <ThemedText style={styles.cardTitle}>{t("admin.waitlist.addTitle")}</ThemedText>
            <View style={styles.addFields}>
              <View style={styles.addField}>
                <Input
                  placeholder={t("admin.waitlist.nameLabel")}
                  accessibilityLabel={t("admin.waitlist.nameLabel")}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  testID="waitlist-add-name"
                />
              </View>
              <View style={[styles.addField, styles.addSeats]}>
                <Select
                  icon="people-outline"
                  accessibilityLabel={t("admin.waitlist.seatsLabel")}
                  options={seatOptions}
                  selectedValue={seats}
                  onSelect={(value) => setSeats(Number(value))}
                />
              </View>
              <View style={styles.addField}>
                <Input
                  placeholder={t("admin.waitlist.emailLabel")}
                  accessibilityLabel={t("admin.waitlist.emailLabel")}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  testID="waitlist-add-email"
                />
              </View>
              <Button
                size="md"
                icon="add"
                loading={adding}
                disabled={!canAdd}
                onPress={add}
                testID="waitlist-add-submit"
              >
                {t("admin.waitlist.add")}
              </Button>
            </View>
          </View>

          {error && (
            <ThemedText testID="waitlist-error" style={[styles.error, { color: colors.error }]}>
              {error}
            </ThemedText>
          )}

          {board === undefined ? (
            <ActivityIndicator testID="waitlist-board-loading" />
          ) : board === null ? (
            <ThemedText style={[styles.error, { color: colors.error }]}>
              {t("admin.waitlist.loadFailed")}
            </ThemedText>
          ) : (
            <View
              style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              {board.entries.length === 0 ? (
                <View style={styles.empty}>
                  <ThemedText style={{ color: colors.muted }}>
                    {t("admin.waitlist.empty")}
                  </ThemedText>
                </View>
              ) : (
                board.entries.map((entry) => (
                  <WaitlistRow
                    key={entry.id}
                    entry={entry}
                    busy={busyId === entry.id}
                    onAction={(action) => act(entry.id, action)}
                  />
                ))
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
