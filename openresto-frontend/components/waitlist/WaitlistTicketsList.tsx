import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "@/components/booking/RecentBookingsList.styles";
import { useWaitlistEntry } from "./useWaitlistEntry";
import { STATUS_TITLES } from "./WaitlistTicket";

/**
 * The waitlist tickets this device holds, listed in My bookings beside the recent bookings.
 * Each row reads its own ticket, so it names the location and where the party stands.
 *
 * @see [WaitlistTicketsList.test.tsx](../../tests/components/waitlist/WaitlistTicketsList.test.tsx)
 */
export default function WaitlistTicketsList({
  entryRefs,
  activeRef,
  onSelect,
}: {
  entryRefs: string[];
  /** The ticket open in the result panel, marked as the selected row. */
  activeRef: string | null;
  onSelect: (entryRef: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  if (entryRefs.length === 0) return null;

  return (
    <View style={styles.section}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>
        {t("lookup.waitlist.heading")}
      </ThemedText>
      {entryRefs.map((entryRef) => (
        <TicketRow
          key={entryRef}
          entryRef={entryRef}
          active={entryRef === activeRef}
          onPress={() => onSelect(entryRef)}
        />
      ))}
    </View>
  );
}

function TicketRow({
  entryRef,
  active,
  onPress,
}: {
  entryRef: string;
  active: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors, primaryColor, isDark } = useAppTheme();
  const { entry } = useWaitlistEntry(entryRef);

  const name = entry?.restaurantName ?? t("booking.waitlistStatus.routeTitle");
  const meta =
    entry === null
      ? t("booking.waitlistStatus.notFound")
      : entry
        ? `${t("booking.waitlistStatus.ticket", { number: entry.number })} · ${t(STATUS_TITLES[entry.status])}`
        : "";

  return (
    <Pressable
      testID={`waitlist-ticket-row-${entryRef}`}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        active && {
          borderColor: primaryColor,
          backgroundColor: isDark ? `${primaryColor}1A` : `${primaryColor}0D`,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t("lookup.waitlist.itemA11y", { name })}
    >
      <View style={styles.cardRow}>
        <View style={{ flex: 1, gap: 3 }}>
          <ThemedText style={styles.ref}>{name}</ThemedText>
          <ThemedText style={[styles.meta, { color: colors.muted }]}>{meta}</ThemedText>
        </View>
        <Icon
          name={active ? "checkmark-circle" : "chevron-forward-outline"}
          size="md"
          color={active ? primaryColor : colors.muted}
        />
      </View>
    </Pressable>
  );
}
