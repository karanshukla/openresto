import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import HorizontalScroller from "@/components/common/HorizontalScroller";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { AdminRestaurantSummary } from "@/api/admin";
import { styles } from "./LocationPills.styles";

export interface LocationPillsProps {
  restaurants: AdminRestaurantSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/**
 * The screen's only location selector. Archived locations sit in the same row as active ones —
 * dimmed and badged, not hidden — because a selector that omits them leaves an archived location
 * with nowhere to be viewed, and a second selector elsewhere is how you end up editing one
 * location while acting on another.
 */
export function LocationPills({ restaurants, selectedId, onSelect }: LocationPillsProps) {
  const { t } = useTranslation();
  const { colors, primaryColor } = useAppTheme();

  return (
    <HorizontalScroller
      label={t("admin.locations.pills.label")}
      contentContainerStyle={styles.content}
    >
      {restaurants.map((r) => {
        const selected = selectedId === r.id;
        const archived = r.isArchived ?? false;
        return (
          <Pressable
            key={r.id}
            onPress={() => onSelect(r.id)}
            accessibilityRole="radio"
            accessibilityLabel={
              archived ? t("admin.locations.pills.archivedLabel", { name: r.name }) : r.name
            }
            accessibilityState={{ checked: selected }}
            style={[
              styles.pill,
              {
                borderColor: selected ? primaryColor : colors.border,
                backgroundColor: selected ? primaryColor : "transparent",
              },
            ]}
          >
            {archived && (
              <Icon name="archive-outline" size="xs" color={selected ? "#fff" : colors.muted} />
            )}
            <ThemedText
              style={[
                styles.label,
                archived && styles.archivedLabel,
                { color: selected ? "#fff" : colors.muted },
              ]}
            >
              {r.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </HorizontalScroller>
  );
}

export default LocationPills;
