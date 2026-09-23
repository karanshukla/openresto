import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import type { LocationPacingDto } from "@/api/admin";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { BAR_MAX_HEIGHT, styles } from "./CoverPacingCard.styles";

/**
 * Today's arrivals per slot at each location with a cover cap, one bar per slot scaled to the
 * cap, so a manager can see where the cap bites. A full slot turns red. Renders nothing when no
 * location has a cap.
 *
 * @see [CoverPacingCard.test.tsx](../../../tests/components/admin/dashboard/CoverPacingCard.test.tsx):
 * pins that it stays silent without a cap and marks a slot at the cap as full.
 */
export function CoverPacingCard({ pacing }: { pacing: LocationPacingDto[] }) {
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  if (pacing.length === 0) return null;

  const trackColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return (
    <View
      testID="cover-pacing-card"
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <ThemedText style={styles.title}>{t("admin.dashboard.pacing.title")}</ThemedText>
      {pacing.map((location) => (
        <View key={location.restaurantId} style={styles.location}>
          <View style={styles.locationHeader}>
            <ThemedText style={styles.locationName}>{location.restaurantName}</ThemedText>
            <ThemedText style={[styles.meta, { color: colors.muted }]}>
              {t("admin.dashboard.pacing.cap", { count: location.maxCoversPerSlot })}
            </ThemedText>
          </View>
          {location.slots.length === 0 ? (
            <ThemedText style={[styles.meta, { color: colors.muted }]}>
              {t("admin.dashboard.pacing.empty")}
            </ThemedText>
          ) : (
            <View style={styles.bars}>
              {location.slots.map((slot) => {
                const full = slot.covers >= location.maxCoversPerSlot;
                const height =
                  Math.min(1, slot.covers / location.maxCoversPerSlot) * BAR_MAX_HEIGHT;
                return (
                  <View
                    key={slot.time}
                    testID={`pacing-slot-${location.restaurantId}-${slot.time}`}
                    accessible
                    accessibilityLabel={t("admin.dashboard.pacing.slotLabel", {
                      time: slot.time,
                      covers: slot.covers,
                      cap: location.maxCoversPerSlot,
                    })}
                    style={styles.slot}
                  >
                    <ThemedText style={[styles.slotText, { color: colors.muted }]}>
                      {slot.covers}
                    </ThemedText>
                    <View style={[styles.track, { backgroundColor: trackColor }]}>
                      <View
                        testID={full ? "pacing-bar-full" : undefined}
                        style={[
                          styles.bar,
                          { height, backgroundColor: full ? theme.colors.error : primaryColor },
                        ]}
                      />
                    </View>
                    <ThemedText style={[styles.slotText, { color: colors.muted }]}>
                      {slot.time}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
