import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MAX_SEAT_OPTIONS } from "@/utils/tonight";
import type { FloorUnit } from "@/api/tonight";
import { styles } from "./SeatOptions.styles";

/**
 * Where a picked party can sit, listed under the party itself so the host never has to carry
 * them across the screen to the floor: one press on a table seats them. The first table is the
 * recommended one and the only filled button; past `MAX_SEAT_OPTIONS` the rest are counted, and
 * stay reachable as lit tiles on the floor.
 *
 * @see [SeatOptions.test.tsx](../../../tests/components/admin/tonight/SeatOptions.test.tsx) —
 * pins the first table as the filled one, and the cap with its count of the rest.
 */
export function SeatOptions({
  id,
  partyName,
  options,
  labelFor,
  busy,
  onSeat,
}: {
  /** Distinguishes this party's buttons from another's in test ids. */
  id: string;
  partyName: string;
  /** Best first. */
  options: FloorUnit[];
  labelFor: (unit: FloorUnit) => string;
  busy: boolean;
  onSeat: (unit: FloorUnit) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const shown = options.slice(0, MAX_SEAT_OPTIONS);
  const hidden = options.length - shown.length;

  return (
    <View style={styles.tray} testID={`seat-options-${id}`}>
      <ThemedText style={[styles.title, { color: colors.muted }]}>
        {t("admin.tonight.seatAt.title", { name: partyName })}
      </ThemedText>
      <ButtonRow align="start">
        {shown.map((unit, index) => (
          <Button
            key={`${unit.kind}-${unit.id}`}
            size="md"
            variant={index === 0 ? "primary" : "secondary"}
            disabled={busy}
            onPress={() => onSeat(unit)}
            accessibilityLabel={t("admin.tonight.tile.seatLabel", {
              name: partyName,
              table: labelFor(unit),
            })}
            testID={`seat-option-${id}-${unit.kind}-${unit.id}`}
          >
            {t("admin.tonight.seatAt.option", {
              table: labelFor(unit),
              seats: t("admin.tonight.tile.seats", { count: unit.seats }),
            })}
          </Button>
        ))}
      </ButtonRow>
      {hidden > 0 && (
        <ThemedText
          style={[styles.more, { color: colors.muted }]}
          testID={`seat-options-more-${id}`}
        >
          {t("admin.tonight.seatAt.more", { count: hidden })}
        </ThemedText>
      )}
    </View>
  );
}
