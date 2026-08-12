import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./LocationTagsSection.styles";
import { Icon } from "@/components/common/Icon";

export interface LocationTagsSectionProps {
  tags: string[];
  tagInput: string;
  // Callbacks — the parent (RestaurantInfoForm) owns the state.
  onSetTagInput: (v: string) => void;
  onAddTag: (raw: string) => void;
  onRemoveTag: (tag: string) => void;
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  surface2: string;
}

/**
 * The "Location tags" section of RestaurantInfoForm — chip list with remove + an add input
 * (Enter or blur commits, plus an add button). Presentational: receives all state + setters as
 * props, owns no data fetching.
 */
export function LocationTagsSection({
  tags,
  tagInput,
  onSetTagInput,
  onAddTag,
  onRemoveTag,
  borderColor,
  mutedColor,
  primaryColor,
  surface2,
}: LocationTagsSectionProps) {
  return (
    <View style={styles.wrapper}>
      <ThemedText style={[settingsStyles.fieldLabel, { color: mutedColor }]}>
        Location tags
      </ThemedText>
      {tags.length > 0 && (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <View key={tag} style={[styles.chip, { backgroundColor: surface2, borderColor }]}>
              <ThemedText style={styles.chipText}>{tag}</ThemedText>
              <Pressable
                onPress={() => onRemoveTag(tag)}
                testID={`remove-tag-${tag}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${tag}`}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Icon name="close" size="xs" color={mutedColor} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={styles.addRow}>
        <View style={styles.addInput}>
          <Input
            value={tagInput}
            onChangeText={onSetTagInput}
            placeholder="Add tag (press Enter)"
            onSubmitEditing={() => onAddTag(tagInput)}
            onBlur={() => tagInput.trim() && onAddTag(tagInput)}
          />
        </View>
        <Pressable
          onPress={() => onAddTag(tagInput)}
          accessibilityRole="button"
          accessibilityLabel="Add tag"
          disabled={!tagInput.trim()}
          style={[
            styles.addBtn,
            { opacity: tagInput.trim() ? 1 : 0.4, backgroundColor: primaryColor },
          ]}
        >
          <Icon name="add" size="lg" color="#fff" />
        </Pressable>
      </View>
      <ThemedText style={[styles.hint, { color: mutedColor }]}>
        Short labels shown on the public restaurant card (e.g. "Dog friendly", "Terrace").
      </ThemedText>
    </View>
  );
}
