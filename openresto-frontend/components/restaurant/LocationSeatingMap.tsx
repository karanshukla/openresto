import { useMemo } from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Icon } from "@/components/common/Icon";
import type { RestaurantDto } from "@/api/restaurants";
import { groupDisplayName, groupedTableIds } from "@/utils/tableGroups";
import { styles } from "./LocationListItem.styles";

export interface LocationSeatingMapProps {
  restaurant: RestaurantDto;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
}

/**
 * Sections and their tables, plus the groups an admin has flagged as pushable together.
 *
 * Grouped tables stay listed individually because they stay individually bookable — the
 * link glyph marks them rather than folding them away.
 */
export function LocationSeatingMap({
  restaurant,
  isDark,
  borderColor,
  mutedColor,
  primaryColor,
}: LocationSeatingMapProps) {
  const tableGroups = restaurant.groups ?? [];
  // Keyed off restaurant.groups, not tableGroups — the `?? []` fallback is a fresh array each
  // render, which would defeat the memo on locations that have no groups.
  const groupMemberIds = useMemo(
    () => groupedTableIds(restaurant.groups ?? []),
    [restaurant.groups]
  );

  if (restaurant.sections.length === 0) return null;

  return (
    <View style={styles.subSection}>
      <ThemedText type="defaultSemiBold" style={styles.subHeading}>
        Seating &amp; tables
      </ThemedText>
      <View style={styles.sectionsGrid}>
        {restaurant.sections.map((section) => (
          <ThemedView key={section.id} style={[styles.sectionCard, { borderColor }]}>
            <ThemedText style={styles.sectionName}>{section.name}</ThemedText>
            <View style={styles.tableGrid}>
              {section.tables.map((table) => (
                <View
                  key={table.id}
                  style={[
                    styles.tableChip,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                      borderColor,
                    },
                  ]}
                >
                  <View style={styles.tableNameRow}>
                    <ThemedText style={styles.tableName}>
                      {table.name ?? `Table ${table.id}`}
                    </ThemedText>
                    {groupMemberIds.has(table.id) && (
                      <Icon name="link" size={11} color={primaryColor} />
                    )}
                  </View>
                  <ThemedText style={[styles.tableSeats, { color: mutedColor }]}>
                    {table.seats} seats
                  </ThemedText>
                </View>
              ))}
            </View>
          </ThemedView>
        ))}
      </View>

      {tableGroups.length > 0 && (
        <View style={styles.groupBlock}>
          <ThemedText style={[styles.groupBlockHeading, { color: mutedColor }]}>
            Tables we can combine
          </ThemedText>
          {tableGroups.map((group) => (
            <View
              key={group.id}
              style={[
                styles.groupRow,
                { borderColor: `${primaryColor}55`, backgroundColor: `${primaryColor}12` },
              ]}
            >
              <Icon name="link" size={15} color={primaryColor} />
              <View style={styles.groupTextCol}>
                <ThemedText style={styles.groupName}>{groupDisplayName(group)}</ThemedText>
                <ThemedText style={[styles.groupSeats, { color: mutedColor }]}>
                  Seats up to {group.combinedSeats} pushed together
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default LocationSeatingMap;
