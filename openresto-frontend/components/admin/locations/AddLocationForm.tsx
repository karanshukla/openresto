import { TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import Button from "@/components/common/Button";
import { theme } from "@/theme/theme";
import { Icon } from "@/components/common/Icon";

export interface AddLocationFormProps {
  value: string;
  saving: boolean;
  isDark: boolean;
  mutedColor: string;
  primaryColor: string;
  onValueChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Inline "add location" form — name input + Add button + cancel.
 */
export function AddLocationForm({
  value,
  saving,
  isDark,
  mutedColor,
  primaryColor,
  onValueChange,
  onSubmit,
  onCancel,
}: AddLocationFormProps) {
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: isDark ? `${primaryColor}40` : `${primaryColor}30`,
        borderRadius: theme.borderRadius.card,
        backgroundColor: isDark ? `${primaryColor}08` : `${primaryColor}04`,
      }}
    >
      <Icon name="storefront-outline" size="lg" color={primaryColor} />
      <TextInput
        value={value}
        onChangeText={onValueChange}
        placeholder={t("admin.locations.addForm.namePlaceholder")}
        placeholderTextColor={mutedColor}
        autoFocus
        style={{
          flex: 1,
          fontSize: 14,
          color: isDark ? "#fff" : "#111",
        }}
      />
      <Button
        testID="add-location-cancel"
        variant="secondary"
        tone="neutral"
        size="md"
        onPress={onCancel}
        accessibilityLabel={t("admin.locations.addForm.cancelLabel")}
      >
        {t("common.actions.cancel")}
      </Button>
      <Button
        size="md"
        disabled={saving || !value.trim()}
        loading={saving}
        onPress={onSubmit}
        accessibilityLabel={t("admin.locations.addLocation")}
      >
        {saving ? t("common.status.adding") : t("admin.locations.addForm.add")}
      </Button>
    </View>
  );
}
