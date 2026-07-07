import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { SubLabel } from "./settingsShared";
import type { EmailFailureDto } from "@/api/admin";

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
    <View style={{ gap: 8 }}>
      <SubLabel mutedColor={mutedColor}>Send failures</SubLabel>
      <View
        style={{
          borderWidth: 1,
          borderColor: dangerBorder,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: dangerSoft,
        }}
      >
        {failures.map((f, i) => {
          const date = new Date(f.attemptedAt);
          const dateStr = date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <View
              key={f.id}
              style={{
                padding: 12,
                paddingHorizontal: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: dangerBorder,
                gap: 3,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="warning-outline" size={13} color={dangerColor} />
                <ThemedText
                  style={{ fontSize: 12.5, fontWeight: "500", flex: 1 }}
                  numberOfLines={1}
                >
                  {f.recipientEmail}
                </ThemedText>
                <ThemedText style={{ fontSize: 11, color: mutedColor }}>{dateStr}</ThemedText>
              </View>
              {f.bookingRef && (
                <ThemedText style={{ fontSize: 11.5, color: mutedColor, paddingLeft: 19 }}>
                  Ref: {f.bookingRef}
                </ThemedText>
              )}
              <ThemedText
                style={{ fontSize: 11.5, color: dangerColor, paddingLeft: 19 }}
                numberOfLines={2}
              >
                {f.errorMessage}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
