import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { SubLabel } from "./settingsShared";
import type { EmailFailureDto } from "@/api/admin";
import { Icon } from "@/components/common/Icon";
import { fmtDateTime } from "@/utils/formatters";
import { styles } from "./EmailFailuresList.styles";

export interface EmailFailuresListProps {
  failures: EmailFailureDto[];
  mutedColor: string;
  dangerBorder: string;
  dangerSoft: string;
  dangerColor: string;
}

/**
 * The "Send failures" log shown in the EmailSettingsCard right column when there are recent
 * delivery failures. Presentational: receives the fetched failures + theme colors as props.
 * Extracted during Bundle 9B-2 decomposition.
 */
export function EmailFailuresList({
  failures,
  mutedColor,
  dangerBorder,
  dangerSoft,
  dangerColor,
}: EmailFailuresListProps) {
  if (failures.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <SubLabel mutedColor={mutedColor}>Send failures</SubLabel>
      <View style={[styles.list, { borderColor: dangerBorder, backgroundColor: dangerSoft }]}>
        {failures.map((f, i) => {
          const date = new Date(f.attemptedAt);
          const dateStr = fmtDateTime(date);
          return (
            <View
              key={f.id}
              style={[
                styles.entry,
                { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: dangerBorder },
              ]}
            >
              <View style={styles.entryHeader}>
                <Icon name="warning-outline" size={13} color={dangerColor} />
                <ThemedText style={styles.recipient} numberOfLines={1}>
                  {f.recipientEmail}
                </ThemedText>
                <ThemedText style={[styles.timestamp, { color: mutedColor }]}>{dateStr}</ThemedText>
              </View>
              {f.bookingRef && (
                <ThemedText style={[styles.detail, { color: mutedColor }]}>
                  Ref: {f.bookingRef}
                </ThemedText>
              )}
              <ThemedText style={[styles.detail, { color: dangerColor }]} numberOfLines={2}>
                {f.errorMessage}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
