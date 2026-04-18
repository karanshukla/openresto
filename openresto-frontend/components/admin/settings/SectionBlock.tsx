import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { SectionDto, TableDto, updateSection, deleteSection, addTable } from "@/api/restaurants";
import { EditableRow } from "./EditableRow";
import { TableRow } from "./TableRow";
import { AddRow } from "./AddRow";
import { COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { styles } from "./settings.styles";

export function SectionBlock({
  section,
  restaurantId,
  isDark,
  borderColor,
  mutedColor,
  onSectionRenamed,
  onSectionDeleted,
  onTableAdded,
  onTableUpdated,
  onTableDeleted,
  confirmAction,
}: {
  section: SectionDto;
  restaurantId: number;
  isDark: boolean;
  borderColor: string;
  mutedColor: string;
  confirmAction: (msg: string) => Promise<boolean>;
  onSectionRenamed: (name: string) => void;
  onSectionDeleted: () => void;
  onTableAdded: (t: TableDto) => void;
  onTableUpdated: (t: TableDto) => void;
  onTableDeleted: (id: number) => void;
}) {
  const sectionBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  return (
    <View style={[styles.sectionBlock, { borderBottomColor: borderColor, borderBottomWidth: 1, marginBottom: 24, paddingBottom: 16 }]}>
      <View style={{ marginBottom: 4 }}>
        <ThemedText style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: primaryColor, marginBottom: 4 }}>DINING SECTION</ThemedText>
        <EditableRow
          value={section.name}
          placeholder="e.g. Main Dining Room"
          isDark={isDark}
          deleteLabel="Delete section"
          confirmAction={confirmAction}
          onSave={async (name) => {
            const result = await updateSection(restaurantId, section.id, name);
            if (result) onSectionRenamed(result.name);
          }}
          onDelete={async () => {
            const ok = await confirmAction(`Delete section "${section.name}" and all its tables?`);
            if (!ok) return;
            const success = await deleteSection(restaurantId, section.id);
            if (success) onSectionDeleted();
          }}
        />
      </View>
      <View style={[styles.tableList, { borderLeftColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)", borderLeftWidth: 3, marginLeft: 6, paddingLeft: 16, marginTop: 8 }]}>
        <ThemedText style={{ fontSize: 11, fontWeight: "700", color: mutedColor, marginBottom: 4, letterSpacing: 0.8, opacity: 0.8 }}>TABLES IN THIS AREA</ThemedText>
        {section.tables.map((t) => (
          <TableRow
            key={t.id}
            table={t}
            restaurantId={restaurantId}
            sectionId={section.id}
            isDark={isDark}
            borderColor={borderColor}
            onUpdated={onTableUpdated}
            onDeleted={() => onTableDeleted(t.id)}
            confirmAction={confirmAction}
          />
        ))}
        {section.tables.length === 0 && (
          <ThemedText style={styles.emptyNote}>
            No tables in this section.
          </ThemedText>
        )}
        <View style={{ marginTop: 12, marginLeft: -20 }}>
          <AddRow
            label="Add Table"
            placeholder="Table name (e.g. Table 1)"
            extraPlaceholder="Guests"
            onAdd={async (name, extra) => {
              const seats = parseInt(extra ?? "2", 10);
              const result = await addTable(restaurantId, section.id, {
                name,
                seats: isNaN(seats) ? 2 : seats,
              });
              if (result) onTableAdded(result);
            }}
          />
        </View>
      </View>
    </View>
  );
}
