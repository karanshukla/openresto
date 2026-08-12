import { useState } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Select, { type SelectOption } from "@/components/common/Select";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./AddRow.styles";
import { Icon } from "@/components/common/Icon";

export function AddRow({
  label,
  placeholder,
  onAdd,
  extraPlaceholder,
  extraOptions,
}: {
  label: string;
  placeholder?: string;
  onAdd: (name: string, extra?: string) => Promise<void>;
  extraPlaceholder?: string;
  /**
   * When provided, the extra field renders as a dropdown (Select) constrained to these options
   * rather than a free-text numeric input. Used for the add-table "Seats" field so a value can't be
   * typed that the server would reject.
   */
  extraOptions?: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  const { primaryColor } = useAppTheme();

  // Collapsed — a self-sized filled-primary pill, aligned right (matches the Add CTA pattern in
  // HighlightsCard: `alignSelf: flex-start` there is left; here we right-align per the settings
  // table/section layout). Keeps the verbatim label so callers' tests keep resolving it.
  if (!open) {
    return (
      <Pressable
        style={[settingsStyles.addPill, styles.addPillRight, { backgroundColor: primaryColor }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Icon name="add" size="md" color="#fff" />
        <ThemedText style={settingsStyles.addPillText}>{label}</ThemedText>
      </Pressable>
    );
  }

  // Expanded — inputs + a right-aligned footer: filled-primary text Add and a bordered close (X)
  // icon so the dismiss affordance is consistent with the rest of the row actions.
  return (
    <View style={settingsStyles.addForm}>
      <View style={styles.fields}>
        <View style={{ flex: extraPlaceholder ? 3 : 1 }}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={placeholder ?? "Name"}
            autoFocus
          />
        </View>
        {extraPlaceholder && (
          <View style={styles.extraField}>
            {extraOptions ? (
              <Select
                selectedValue={extra || undefined}
                onSelect={(v) => setExtra(String(v))}
                options={extraOptions}
                placeholder={extraPlaceholder}
              />
            ) : (
              <Input
                value={extra}
                onChangeText={setExtra}
                placeholder={extraPlaceholder}
                keyboardType="numeric"
              />
            )}
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <Pressable
          onPress={async () => {
            if (!name.trim()) return;
            setSaving(true);
            await onAdd(name.trim(), extra || undefined);
            setSaving(false);
            setName("");
            setExtra("");
            setOpen(false);
          }}
          disabled={saving || !name.trim()}
          style={[
            settingsStyles.actionBtn,
            { backgroundColor: primaryColor, opacity: saving ? 0.6 : 1 },
          ]}
        >
          <ThemedText style={[settingsStyles.actionBtnText, { color: "#fff" }]}>
            {saving ? "Adding…" : "Add"}
          </ThemedText>
        </Pressable>
        <Pressable
          style={styles.cancelBtn}
          onPress={() => {
            setOpen(false);
            setName("");
            setExtra("");
          }}
          accessibilityRole="button"
          accessibilityLabel="Cancel add"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size="md" color={theme.colors.muted.light} />
        </Pressable>
      </View>
    </View>
  );
}
