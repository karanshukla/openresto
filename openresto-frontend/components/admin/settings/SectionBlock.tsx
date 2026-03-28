import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { SectionDto, TableDto, updateSection, deleteSection, addTable } from "@/api/restaurants";
import { EditableRow } from "./EditableRow";
import { TableRow } from "./TableRow";
import { AddRow } from "./AddRow";
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

  return (
    <View style={[styles.sectionBlock, { borderColor, backgroundColor: sectionBg }]}>
      <EditableRow
        value={section.name}
        placeholder="Section name"
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
      <View style={styles.tableList}>
        {section.tables.length === 0 && (
          <ThemedText style={[styles.emptyNote, { color: mutedColor }]}>No tables yet.</ThemedText>
        )}
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
        <AddRow
          label="Add Table"
          placeholder="e.g. T1, Window Booth"
          extraPlaceholder="Seats (e.g. 4)"
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
  );
}
