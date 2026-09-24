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
import ConfirmModal from "@/components/common/ConfirmModal";
import { Icon } from "@/components/common/Icon";
import WaitlistRow, { waitlistPartyName } from "@/components/admin/waitlist/WaitlistRow";
import { LocationPills } from "@/components/admin/locations/LocationPills";
import { fetchRestaurants } from "@/api/restaurants";
import {
  actOnWaitlistEntry,
  addWaitlistParty,
  getWaitlistBoard,
  type WaitlistBoard,
  type WaitlistEntry,
} from "@/api/waitlist";
import { isValidEmail } from "@/utils/validation";
import { styles } from "@/styles/admin/waitlist.styles";
import { styles as stateStyles } from "@/styles/admin/activity.styles";

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
  const { colors, primaryColor } = useAppTheme();

  const [restaurants, setRestaurants] = useState<{ id: number; name: string }[] | null>(null);
  const [restaurantId, setRestaurantId] = usePersistedState<number | null>(
    "waitlist:restaurantId",
    null
  );
  const [board, setBoard] = useState<WaitlistBoard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<WaitlistEntry | null>(null);

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
        <View style={stateStyles.center}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : restaurants.length === 0 ? (
        <ThemedText style={{ color: colors.muted }}>{t("admin.waitlist.noLocations")}</ThemedText>
      ) : (
        <>
          <LocationPills
            restaurants={restaurants}
            selectedId={selectedId}
            onSelect={setRestaurantId}
          />

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <ThemedText style={styles.cardTitle}>{t("admin.waitlist.addTitle")}</ThemedText>
            <View style={styles.addFields}>
              <View style={[styles.addField, styles.field]}>
                <ThemedText style={styles.label}>{t("admin.waitlist.nameLabel")}</ThemedText>
                <Input
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
              <View style={[styles.addField, styles.field]}>
                <ThemedText style={styles.label}>{t("admin.waitlist.emailLabel")}</ThemedText>
                <Input
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
            <ThemedText
              testID="waitlist-error"
              style={[styles.error, { color: colors.error }]}
              role="alert"
              accessibilityLiveRegion="assertive"
            >
              {error}
            </ThemedText>
          )}

          {board === undefined ? (
            <View style={stateStyles.center}>
              <ActivityIndicator
                testID="waitlist-board-loading"
                size="large"
                color={primaryColor}
              />
            </View>
          ) : board === null ? (
            <View style={stateStyles.center} role="alert" accessibilityLiveRegion="assertive">
              <View style={[stateStyles.emptyIconRing, { borderColor: colors.border }]}>
                <Icon name="warning-outline" size={28} color={colors.muted} />
              </View>
              <ThemedText style={[stateStyles.emptyTitle, { color: colors.text }]}>
                {t("errors.generic")}
              </ThemedText>
              <ThemedText style={[stateStyles.emptyBody, { color: colors.muted }]}>
                {t("admin.waitlist.loadFailed")}
              </ThemedText>
            </View>
          ) : board.entries.length === 0 ? (
            <View style={stateStyles.center}>
              <View style={[stateStyles.emptyIconRing, { borderColor: colors.border }]}>
                <Icon name="people-outline" size={28} color={colors.muted} />
              </View>
              <ThemedText style={[stateStyles.emptyTitle, { color: colors.text }]}>
                {t("admin.waitlist.empty")}
              </ThemedText>
              <ThemedText style={[stateStyles.emptyBody, { color: colors.muted }]}>
                {t("admin.waitlist.emptyBody")}
              </ThemedText>
            </View>
          ) : (
            <View
              style={[styles.list, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              {board.entries.map((entry, index) => (
                <WaitlistRow
                  key={entry.id}
                  entry={entry}
                  busy={busyId === entry.id}
                  isLast={index === board.entries.length - 1}
                  onAction={(action) =>
                    action === "remove" ? setRemoveTarget(entry) : act(entry.id, action)
                  }
                />
              ))}
            </View>
          )}
        </>
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
          if (!removeTarget) return;
          setRemoveTarget(null);
          act(removeTarget.id, "remove");
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </ScrollView>
  );
}
