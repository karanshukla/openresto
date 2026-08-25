import { ThemedText } from "@/components/themed-text";
import { Pressable, ScrollView, View } from "react-native";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconName } from "@/components/common/Icon";
import { AnchoredPanel } from "@/components/common/AnchoredPanel";
import { useAnchorTracking } from "@/hooks/use-anchor-tracking";
import { useAppTheme } from "@/hooks/use-app-theme";
import * as Haptics from "expo-haptics";
import { hexToRgba } from "@/utils/colors";
import { scrollIntoView } from "@/utils/scrollIntoView";
import { openIndexFor, resolveListboxKey, TYPEAHEAD_RESET_MS } from "@/utils/listboxKeys";
import { LISTBOX_ROLE, webProps, type WebKeyEvent } from "@/utils/webProps";
import { styles } from "./Select.styles";

/** The brand tint on the option holding the current value. */
const SELECTED_TINT = 0.08;
/**
 * ...and on the one the pointer or the keyboard is resting on, which has to read stronger than
 * the selected row it can land on. Mixed with `hexToRgba` rather than by appending hex digits to
 * the brand colour: a three-digit brand ("#0a7") concatenated with an alpha pair is not a colour
 * at all, and renders as nothing.
 */
const HIGHLIGHT_TINT = 0.16;

export interface SelectOption {
  label: string;
  value: string | number;
}

/**
 * The app's one dropdown: a combobox trigger over a listbox of values.
 *
 * The roles are the ones a value picker is supposed to carry. It was a `menu` of `menuitem`s,
 * which is the pattern for commands — a screen reader announced "menu" for a control whose
 * whole job is holding a value, and told nobody which value it held (issue #348).
 *
 * The open list keeps focus on itself and moves an `aria-activedescendant` highlight, rather
 * than moving focus from option to option. That is what makes one keydown handler enough for
 * a fifty-row seat picker, and it is why the options carry `tabIndex={-1}`: the list is the
 * keyboard's target, the rows are not.
 *
 * @see [Select.test.tsx](../../tests/components/Select.test.tsx) — pins the roles, and each
 * key against the behaviour it is supposed to have.
 */
export default function Select({
  options,
  onSelect,
  selectedValue,
  placeholder,
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
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("common.select.placeholder");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<View>(null);
  const listRef = useRef<ScrollView>(null);
  const optionRefs = useRef<(View | null)[]>([]);
  const typeahead = useRef("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { panel, measure, release } = useAnchorTracking(triggerRef);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  const { colors, isDark, primaryColor } = useAppTheme();
  const dividerColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const selectedIndex = options.findIndex((o) => o.value === selectedValue);
  const selectedOption = selectedIndex === -1 ? undefined : options[selectedIndex];

  const clearTypeahead = () => {
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    typeaheadTimer.current = null;
  };
  useEffect(() => clearTypeahead, []);

  const rememberTypeahead = (value: string) => {
    typeahead.current = value;
    clearTypeahead();
    if (value !== "") {
      typeaheadTimer.current = setTimeout(() => {
        typeahead.current = "";
      }, TYPEAHEAD_RESET_MS);
    }
  };

  const close = () => {
    setOpen(false);
    rememberTypeahead("");
  };

  const show = (index: number) => {
    measure();
    setActiveIndex(index);
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    Haptics.selectionAsync();
    onSelect(option.value);
    close();
  };

  // Keeping the highlight on screen is not a nicety once arrow keys exist: without it, the
  // fourth press down a fifty-row list moves a highlight nobody can see. Unanimated on
  // purpose — a list that opens on 20:30 has to be there on the first frame, not scroll the
  // fifty rows to it while the diner watches.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    // No guard on the ref: `scrollIntoView` already ignores a target that isn't there, which
    // is what a highlight left pointing past a list that shrank under it resolves to.
    scrollIntoView({ current: optionRefs.current[activeIndex] }, listRef, {
      block: "nearest",
      animated: false,
    });
  }, [open, activeIndex]);

  const isChorded = (event: WebKeyEvent) => !!(event.ctrlKey || event.metaKey || event.altKey);

  const handleTriggerKey = (event: WebKeyEvent) => {
    if (isChorded(event)) return;
    const from = openIndexFor(
      event.key,
      selectedIndex,
      options.map((o) => o.label),
      false
    );
    if (from === null) return;
    event.preventDefault?.();
    show(from);
  };

  const handleListKey = (event: WebKeyEvent) => {
    if (isChorded(event)) return;
    const result = resolveListboxKey(event.key, {
      activeIndex,
      labels: options.map((o) => o.label),
      typeahead: typeahead.current,
      wrap: false,
    });
    if (result.handled) event.preventDefault?.();
    rememberTypeahead(result.typeahead);
    if (result.activeIndex !== undefined) setActiveIndex(result.activeIndex);
    if (result.commit) commit(activeIndex);
    else if (result.close) close();
  };

  return (
    <>
      <AnchoredPanel
        visible={open}
        onClose={close}
        position={panel}
        onClosed={release}
        role={LISTBOX_ROLE}
        id={listId}
        accessibilityLabel={accessibilityLabel ?? resolvedPlaceholder}
        activeDescendantId={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onKeyDown={handleListKey}
        closeLabel={t("common.select.closeListLabel")}
        backdropTestID="select-backdrop"
        testID="select-list"
      >
        {/*
          Plain ScrollView over FlatList: option counts are small (max ~50 for seat pickers),
          so virtualization buys nothing, and react-native-web's FlatList scroll container
          intercepts the touch-start of a tap (treating it as a potential drag) so the option's
          onPress never fires — the modal just dismisses on pointer-up. A ScrollView with
          nestedScrollEnabled + direct Pressable rows is reliable cross-platform.
        */}
        <ScrollView ref={listRef} style={styles.list} nestedScrollEnabled>
          {options.map((item, i) => {
            const isSelected = i === selectedIndex;
            const isActive = i === activeIndex;
            return (
              <View key={item.value.toString()}>
                <Pressable
                  ref={(node) => {
                    optionRefs.current[i] = node;
                  }}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.option,
                    isSelected && { backgroundColor: hexToRgba(primaryColor, SELECTED_TINT) },
                    (isActive || hovered) && {
                      backgroundColor: hexToRgba(primaryColor, HIGHLIGHT_TINT),
                    },
                    pressed && { opacity: 0.6 },
                  ]}
                  onPress={() => commit(i)}
                  id={optionId(i)}
                  role="option"
                  aria-selected={isSelected}
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: isSelected }}
                  // The list is the keyboard's one focus target; its rows are reached by
                  // arrowing the highlight, not by tabbing through fifty of them.
                  tabIndex={-1}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      isSelected && { color: primaryColor, fontWeight: "600" },
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                  {isSelected && (
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
                  <View style={[styles.separator, { backgroundColor: dividerColor }]} />
                )}
              </View>
            );
          })}
        </ScrollView>
      </AnchoredPanel>

      <Pressable
        ref={triggerRef}
        style={(state) => [
          styles.trigger,
          { borderColor: colors.border, backgroundColor: colors.input },
          (state as { hovered?: boolean }).hovered && { borderColor: primaryColor },
        ]}
        onPress={() => show(selectedIndex)}
        role="combobox"
        aria-expanded={open}
        accessibilityLabel={
          accessibilityLabel
            ? `${accessibilityLabel}, ${selectedOption?.label ?? placeholder}`
            : undefined
        }
        accessibilityState={{ expanded: open }}
        {...webProps({
          onKeyDown: handleTriggerKey,
          "aria-controls": listId,
          "aria-haspopup": "listbox",
        })}
      >
        {icon ? (
          <View style={styles.triggerLead}>
            <Icon name={icon} size="md" color={colors.muted} />
            <ThemedText
              numberOfLines={1}
              style={[styles.triggerText, !selectedOption && { color: colors.muted }]}
            >
              {selectedOption?.label ?? resolvedPlaceholder}
            </ThemedText>
          </View>
        ) : (
          <ThemedText
            numberOfLines={1}
            style={[styles.triggerText, !selectedOption && { color: colors.muted }]}
          >
            {selectedOption?.label ?? resolvedPlaceholder}
          </ThemedText>
        )}
        <Icon name="chevron-down" size="md" color={colors.muted} />
      </Pressable>
    </>
  );
}
