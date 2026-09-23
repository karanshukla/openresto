import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import Select, { type SelectOption } from "@/components/common/Select";
import type { TurnTimeDto } from "@/api/restaurants";
import { theme } from "@/theme/theme";
import { MAX_SEATS, MIN_SEATS } from "@/utils/seatOptions";
import { turnTimeRanges } from "@/utils/turnTimes";
import { RowIconButton } from "./RowIconButton";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./TurnTimesField.styles";

/**
 * Sitting lengths by party size, under the default booking duration. Rows are kept in party-size
 * order, so each one's range reads off the row below it.
 */
export function TurnTimesField({
  rules,
  onChange,
  defaultMinutes,
  durationOptions,
  mutedColor,
}: {
  rules: TurnTimeDto[];
  onChange: (rules: TurnTimeDto[]) => void;
  defaultMinutes: number;
  durationOptions: SelectOption[];
  mutedColor: string;
}) {
  const { t } = useTranslation();
  const ranges = turnTimeRanges(rules);

  const seatOptions: SelectOption[] = [];
  for (let seats = MIN_SEATS; seats <= MAX_SEATS; seats++) {
    seatOptions.push({
      value: seats,
      label: t("admin.settings.restaurantInfo.turnTimesFrom", { count: seats }),
    });
  }

  const sortedWith = (next: TurnTimeDto[]) => [...next].sort((a, b) => a.minSeats - b.minSeats);

  const update = (index: number, patch: Partial<TurnTimeDto>) =>
    onChange(
      sortedWith(ranges.map((r, i) => (i === index ? { ...toRule(r), ...patch } : toRule(r))))
    );

  const remove = (index: number) => onChange(ranges.filter((_, i) => i !== index).map(toRule));

  const add = () => {
    const last = ranges[ranges.length - 1];
    onChange([
      ...ranges.map(toRule),
      {
        minSeats: last ? Math.min(last.minSeats + 1, MAX_SEATS) : MIN_SEATS,
        minutes: last?.minutes ?? defaultMinutes,
      },
    ]);
  };

  return (
    <View style={styles.field} testID="turn-times">
      <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
        {t("admin.settings.restaurantInfo.turnTimesLabel")}
      </ThemedText>
      {ranges.map((range, index) => (
        <View key={index} style={styles.row} testID={`turn-time-row-${index}`}>
          <View style={styles.seatsSelect}>
            <Select
              accessibilityLabel={t("admin.settings.restaurantInfo.turnTimesSeatsLabel")}
              options={seatOptions}
              selectedValue={range.minSeats}
              onSelect={(value) => update(index, { minSeats: Number(value) })}
            />
          </View>
          <View style={styles.minutesSelect}>
            <Select
              accessibilityLabel={t("admin.settings.restaurantInfo.turnTimesMinutesLabel")}
              options={durationOptions}
              selectedValue={range.minutes}
              onSelect={(value) => update(index, { minutes: Number(value) })}
            />
          </View>
          <ThemedText style={[styles.range, { color: mutedColor }]}>
            {range.maxSeats === null
              ? t("admin.settings.restaurantInfo.turnTimesRangeOpen", { seats: range.minSeats })
              : range.maxSeats <= range.minSeats
                ? t("admin.settings.restaurantInfo.turnTimesRangeOne", { seats: range.minSeats })
                : t("admin.settings.restaurantInfo.turnTimesRange", {
                    min: range.minSeats,
                    max: range.maxSeats,
                  })}
          </ThemedText>
          <RowIconButton
            name="trash-outline"
            color={theme.colors.error}
            onPress={() => remove(index)}
            accessibilityLabel={t("admin.settings.restaurantInfo.turnTimesRemove", {
              seats: range.minSeats,
            })}
          />
        </View>
      ))}
      <ThemedText style={[styles.hint, { color: mutedColor }]}>
        {t("admin.settings.restaurantInfo.turnTimesHint")}
      </ThemedText>
      <ButtonRow align="start">
        <Button size="md" icon="add" onPress={add}>
          {t("admin.settings.restaurantInfo.turnTimesAdd")}
        </Button>
      </ButtonRow>
    </View>
  );
}

const toRule = ({ minSeats, minutes }: TurnTimeDto): TurnTimeDto => ({ minSeats, minutes });
