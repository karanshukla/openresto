import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
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
  cardBg: string;
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
  cardBg,
  surface2,
}: LocationTagsSectionProps) {
  const [expanded, setExpanded] = usePersistedState("locations:tags:expanded", true);

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Location Tags"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: `${primaryColor}18` }]}>
          <Icon name="pricetag-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Location Tags</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]} numberOfLines={1}>
            {tags.length === 0
              ? "No tags yet"
              : `${tags.length} tag${tags.length === 1 ? "" : "s"}`}
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }, styles.wrapper]}>
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
            <Button
              size="md"
              icon="add"
              onPress={() => onAddTag(tagInput)}
              disabled={!tagInput.trim()}
              accessibilityLabel="Add tag"
            >
              Add
            </Button>
          </View>
          <ThemedText style={[styles.hint, { color: mutedColor }]}>
            Short labels shown on the public restaurant card (e.g. "Dog friendly", "Terrace").
          </ThemedText>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
