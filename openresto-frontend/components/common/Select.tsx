import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useCallback, useRef, useState } from "react";
import { useCloseOnViewportChange } from "@/hooks/use-close-on-viewport-change";
import { Icon, type IconName } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import * as Haptics from "expo-haptics";
import { measureAnchor, type AnchoredPanel } from "@/utils/selectAnchor";
import { backdropStyleFor, panelStyleFor, styles } from "./Select.styles";

/**
 * Where the options panel should sit, or null to fall back to the centred sheet — which is what
 * native always gets, and what web gets when the trigger cannot be measured.
 *
 * `Modal` portals its content to the document root on web, escaping whatever container the
 * trigger sits in, so the panel cannot be positioned relative to its parent — the trigger's real
 * viewport rect is the only thing it can hang off. Read synchronously rather than through RNW's
 * `measureInWindow`, which defers a tick and would flash the panel at a stale position.
 *
 * @see [selectAnchor.test.ts](../../tests/utils/selectAnchor.test.ts) — pins the measuring and
 * the clamping. The browser half (that a React ref really is a DOM node there) is only true in
 * a browser, so it is pinned by `e2e/admin-activity.spec.ts` instead.
 */
function panelFor(trigger: View | null): AnchoredPanel | null {
  if (Platform.OS !== "web") return null;

  return measureAnchor(trigger, { width: window.innerWidth, height: window.innerHeight });
}

export interface SelectOption {
  label: string;
  value: string | number;
}

export default function Select({
  options,
  onSelect,
  selectedValue,
  placeholder = "Select an option",
  icon,
  accessibilityLabel,
}: {
  options: SelectOption[];
  onSelect: (value: string | number) => void;
  selectedValue?: string | number;
  placeholder?: string;
  /** Optional leading glyph, for compact filter bars where the label alone is ambiguous. */
  icon?: IconName;
  accessibilityLabel?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [panel, setPanel] = useState<AnchoredPanel | null>(null);
  const triggerRef = useRef<View>(null);
  const close = useCallback(() => setModalVisible(false), []);
  // Only the anchored panel goes stale when the viewport moves; the centred sheet does not care.
  useCloseOnViewportChange(modalVisible && panel !== null, close);
  const { colors, isDark, primaryColor } = useAppTheme();
  const borderColor = colors.border;
  const placeholderColor = colors.muted;
  const backgroundColor = colors.input;
  const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const selectedOption = options.find((o) => o.value === selectedValue);

  return (
    <>
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={close}>
        <Pressable
          testID="select-backdrop"
          // A dropdown hanging off its trigger doesn't dim the page behind it; a centred sheet
          // does. The backdrop still covers the screen either way, so a press outside closes.
          style={backdropStyleFor(panel !== null)}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close the options list"
        >
          <ThemedView
            style={panelStyleFor(panel, borderColor)}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel ?? placeholder}
          >
            {/*
              Plain ScrollView over FlatList: option counts are small (max ~50 for seat pickers),
              so virtualization buys nothing, and react-native-web's FlatList scroll container
              intercepts the touch-start of a tap (treating it as a potential drag) so the option's
              onPress never fires — the modal just dismisses on pointer-up. A ScrollView with
              nestedScrollEnabled + direct Pressable rows is reliable cross-platform.
            */}
            <ScrollView style={styles.list} nestedScrollEnabled role="menu">
              {options.map((item, i) => (
                <View key={item.value.toString()}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.option,
                      item.value === selectedValue && { backgroundColor: `${primaryColor}14` },
                      pressed && { opacity: 0.6 },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onSelect(item.value);
                      close();
                    }}
                    role="menuitem"
                    accessibilityLabel={item.label}
                    accessibilityState={{ selected: item.value === selectedValue }}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        item.value === selectedValue && { color: primaryColor, fontWeight: "600" },
                      ]}
                    >
                      {item.label}
                    </ThemedText>
                    {item.value === selectedValue && (
                      <ThemedText
                        style={[styles.checkmark, { color: primaryColor }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      >
                        ✓
                      </ThemedText>
                    )}
                  </Pressable>
                  {i < options.length - 1 && (
                    <ThemedView style={[styles.separator, { backgroundColor: dividerColor }]} />
                  )}
                </View>
              ))}
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Modal>

      <Pressable
        ref={triggerRef}
        style={(state) => [
          styles.trigger,
          { borderColor, backgroundColor },
          (state as { hovered?: boolean }).hovered && { borderColor: primaryColor },
        ]}
        onPress={() => {
          setPanel(panelFor(triggerRef.current));
          setModalVisible(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel
            ? `${accessibilityLabel}, ${selectedOption?.label ?? placeholder}`
            : undefined
        }
        accessibilityState={{ expanded: modalVisible }}
      >
        {icon ? (
          <View style={styles.triggerLead}>
            <Icon name={icon} size="md" color={placeholderColor} />
            <ThemedText
              numberOfLines={1}
              style={[styles.triggerText, !selectedOption && { color: placeholderColor }]}
            >
              {selectedOption?.label ?? placeholder}
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            numberOfLines={1}
            style={[styles.triggerText, !selectedOption && { color: placeholderColor }]}
          >
            {selectedOption?.label ?? placeholder}
          </ThemedText>
        )}
        <Icon name="chevron-down" size="md" color={placeholderColor} />
      </Pressable>
    </>
  );
}
