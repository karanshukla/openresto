import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import Input from "@/components/common/Input";
import Select, { type SelectOption } from "@/components/common/Select";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./AddRow.styles";

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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [saving, setSaving] = useState(false);

  // Collapsed — the standing "add" CTA for the list it heads. Left-aligned so it sits flush with
  // the rows it appends to, matching every other create CTA in the admin (footer links,
  // highlights, users); keeps the verbatim label so callers' tests keep resolving it.
  if (!open) {
    return (
      <ButtonRow align="start">
        <Button size="md" icon="add" onPress={() => setOpen(true)} accessibilityLabel={label}>
          {label}
        </Button>
      </ButtonRow>
    );
  }

  // Expanded — inputs, then the standard dismiss-then-commit action row.
  return (
    <View style={settingsStyles.addForm}>
      <View style={styles.fields}>
        <View style={{ flex: extraPlaceholder ? 3 : 1 }}>
          <Input
            value={name}
            onChangeText={setName}
            placeholder={placeholder ?? t("admin.settings.addRow.namePlaceholder")}
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
      <ButtonRow>
        <Button
          variant="secondary"
          tone="neutral"
          size="md"
          onPress={() => {
            setOpen(false);
            setName("");
            setExtra("");
          }}
          accessibilityLabel={t("admin.settings.addRow.cancelLabel")}
        >
          {t("common.actions.cancel")}
        </Button>
        <Button
          size="md"
          disabled={saving || !name.trim()}
          onPress={async () => {
            if (!name.trim()) return;
            setSaving(true);
            await onAdd(name.trim(), extra || undefined);
            setSaving(false);
            setName("");
            setExtra("");
            setOpen(false);
          }}
        >
          {saving ? t("common.status.adding") : t("admin.settings.addRow.add")}
        </Button>
      </ButtonRow>
    </View>
  );
}
