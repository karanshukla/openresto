import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";

export interface LocationTagsSectionProps {
  tags: string[];
  tagInput: string;
  // Callbacks — the parent (RestaurantInfoForm) owns the state.
  onSetTagInput: (v: string) => void;
  onAddTag: (raw: string) => void;
  onRemoveTag: (tag: string) => void;
  // Theme values (presentational).
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
  surface2: string;
}

/**
 * The "Location tags" section of RestaurantInfoForm — chip list with remove + an add input
 * (Enter or blur commits, plus an add button). Presentational: receives all state + setters as
 * props, owns no data fetching. Extracted during Bundle 9B-1 decomposition.
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
    <View style={{ gap: 6 }}>
      <ThemedText style={{ fontSize: 12, color: mutedColor, fontWeight: "500" }}>
        Location tags
      </ThemedText>
      {tags.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
          {tags.map((tag) => (
            <View
              key={tag}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: surface2,
                borderWidth: 1,
                borderColor,
                borderRadius: 999,
                paddingLeft: 10,
                paddingRight: 6,
                paddingVertical: 4,
              }}
            >
              <ThemedText style={{ fontSize: 12 }}>{tag}</ThemedText>
              <Pressable onPress={() => onRemoveTag(tag)} testID={`remove-tag-${tag}`}>
                <Ionicons name="close" size={12} color={mutedColor} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
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
          disabled={!tagInput.trim()}
          style={{
            opacity: tagInput.trim() ? 1 : 0.4,
            backgroundColor: primaryColor,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 10,
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>
      <ThemedText style={{ fontSize: 11, color: mutedColor }}>
        Short labels shown on the public restaurant card (e.g. "Dog friendly", "Terrace").
      </ThemedText>
    </View>
  );
}
