import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { RestaurantDto, addSection } from "@/api/restaurants";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { RestaurantInfoForm } from "./RestaurantInfoForm";
import { SectionBlock } from "./SectionBlock";
import { AddRow } from "./AddRow";
import { styles } from "./settings.styles";

export function LocationCard({
  restaurant,
  isSelected,
  onSelect,
  onSaved,
  isDark,
  borderColor,
  mutedColor,
  cardBg,
  confirmAction,
}: {
  restaurant: RestaurantDto;
  isSelected: boolean;
  onSelect: () => void;
  onSaved: (patch: Partial<RestaurantDto>) => void;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  confirmAction: (msg: string) => Promise<boolean>;
}) {
  const tableCount = restaurant.sections.reduce((acc, s) => acc + s.tables.length, 0);

  return (
    <View
      style={[
        styles.locationCard,
        { backgroundColor: cardBg, borderColor },
        isSelected && { borderColor: COLORS.primary },
      ]}
    >
      <View style={styles.locationCardHeader}>
        <View style={[styles.locationIcon, { backgroundColor: `${COLORS.primary}14` }]}>
          <Ionicons name="storefront-outline" size={22} color={COLORS.primary} />
        </View>
        <View style={styles.locationMeta}>
          <ThemedText style={styles.locationName}>{restaurant.name}</ThemedText>
          {restaurant.address ? (
            <ThemedText style={[styles.locationAddress, { color: mutedColor }]} numberOfLines={1}>
              {restaurant.address}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.activeBadge}>
          <ThemedText style={styles.activeBadgeText}>ACTIVE</ThemedText>
        </View>
      </View>

      <View style={[styles.locationStats, { borderTopColor: borderColor }]}>
        <View style={styles.locationStat}>
          <ThemedText style={styles.locationStatValue}>{restaurant.sections.length}</ThemedText>
          <ThemedText style={[styles.locationStatLabel, { color: mutedColor }]}>
            Sections
          </ThemedText>
        </View>
        <View style={[styles.locationStatDivider, { backgroundColor: borderColor }]} />
        <View style={styles.locationStat}>
          <ThemedText style={styles.locationStatValue}>{tableCount}</ThemedText>
          <ThemedText style={[styles.locationStatLabel, { color: mutedColor }]}>Tables</ThemedText>
        </View>
        <View style={styles.locationCardAction}>
          <Pressable
            style={[
              styles.configureBtn,
              isSelected
                ? { backgroundColor: COLORS.primary }
                : { backgroundColor: `${COLORS.primary}14` },
            ]}
            onPress={onSelect}
          >
            <Ionicons
              name={isSelected ? "chevron-up" : "settings-outline"}
              size={14}
              color={isSelected ? "#fff" : COLORS.primary}
            />
            <ThemedText
              style={[styles.configureBtnText, { color: isSelected ? "#fff" : COLORS.primary }]}
            >
              {isSelected ? "Close" : "Configure"}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {isSelected && (
        <View style={[styles.expandedEditor, { borderTopColor: borderColor }]}>
          <ThemedText style={styles.editorSectionTitle}>Restaurant Info</ThemedText>
          <RestaurantInfoForm restaurant={restaurant} onSaved={onSaved} />

          <ThemedText style={[styles.editorSectionTitle, { marginTop: 20 }]}>
            Sections & Tables
          </ThemedText>
          <ThemedText style={[styles.editorSectionSub, { color: mutedColor }]}>
            Manage your dining areas and tables.
          </ThemedText>

          {restaurant.sections.map((section) => (
            <SectionBlock
              key={section.id}
              section={section}
              restaurantId={restaurant.id}
              isDark={isDark}
              borderColor={borderColor}
              mutedColor={mutedColor}
              confirmAction={confirmAction}
              onSectionRenamed={(name) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id ? { ...s, name } : s
                  ),
                })
              }
              onSectionDeleted={() =>
                onSaved({
                  sections: restaurant.sections.filter((s) => s.id !== section.id),
                })
              }
              onTableAdded={(t) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id ? { ...s, tables: [...s.tables, t] } : s
                  ),
                })
              }
              onTableUpdated={(t) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id
                      ? {
                          ...s,
                          tables: s.tables.map((x) => (x.id === t.id ? t : x)),
                        }
                      : s
                  ),
                })
              }
              onTableDeleted={(id) =>
                onSaved({
                  sections: restaurant.sections.map((s) =>
                    s.id === section.id ? { ...s, tables: s.tables.filter((x) => x.id !== id) } : s
                  ),
                })
              }
            />
          ))}

          <AddRow
            label="Add Section"
            placeholder="e.g. Indoor, Patio, Bar"
            onAdd={async (name) => {
              const result = await addSection(restaurant.id, name);
              if (result)
                onSaved({
                  sections: [...restaurant.sections, { ...result, tables: [] }],
                });
            }}
          />
        </View>
      )}
    </View>
  );
}
