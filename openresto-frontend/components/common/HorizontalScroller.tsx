import { useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, View, type ScrollViewProps, type ViewStyle } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import IconButton from "@/components/common/IconButton";
import { styles } from "./HorizontalScroller.styles";

/** Ignore the sub-pixel remainder react-native-web reports at either end. */
const EDGE_SLOP = 4;
/** How far a press of one of the scroll buttons travels. */
const STEP = 180;

interface Props extends Omit<ScrollViewProps, "horizontal" | "children"> {
  /**
   * What the row contains, as a screen reader should hear it: "Restaurant highlights",
   * "Locations". Names the region and both scroll buttons.
   */
  label: string;
  /**
   * Give the row its own tab stop. Needed when its contents aren't focusable — a row of
   * plain cards is otherwise unreachable by keyboard past whatever happens to be visible.
   * Leave it off when every child is a control: tabbing between them already scrolls the
   * row, and a stop on the row itself would just be one more press to get through.
   */
  keyboardFocusable?: boolean;
  /**
   * Overlay a scroll button on whichever end still has content. Turn it off for rows of
   * tall items, where a 44px button floats over the content instead of over a gap — a
   * card rail says it scrolls by letting the next card peek instead.
   */
  scrollButtons?: boolean;
  contentContainerStyle?: ViewStyle;
  children: ReactNode;
}

/**
 * A horizontal row that says so. Overflow with a hidden scrollbar is invisible until you
 * happen to drag it: no scrollbar to see, nothing to tab to, and nothing a screen reader
 * announces, so whatever sits past the right edge may as well not exist. This adds the
 * three things that make it discoverable — a scroll button at whichever end still has
 * content, a named region with a hint that it scrolls, and (on request) a tab stop so the
 * arrow keys can drive it.
 */
export default function HorizontalScroller({
  label,
  keyboardFocusable = false,
  scrollButtons = true,
  contentContainerStyle,
  style,
  children,
  onScroll,
  ...rest
}: Props) {
  const { colors, primaryColor } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [offset, setOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const canScrollBack = offset > EDGE_SLOP;
  const canScrollOn = offset + containerWidth < contentWidth - EDGE_SLOP;
  const scrollable = canScrollBack || canScrollOn;

  const scrollBy = (delta: number) =>
    scrollRef.current?.scrollTo({ x: Math.max(0, offset + delta), animated: true });

  const scrollButton = (back: boolean) => (
    <View
      pointerEvents="box-none"
      style={[
        styles.affordance,
        back ? styles.affordanceStart : styles.affordanceEnd,
        { backgroundColor: colors.page + "99" },
      ]}
    >
      <IconButton
        testID={`scroll-${back ? "back" : "forward"}`}
        name={back ? "chevron-back" : "chevron-forward"}
        accessibilityLabel={`Scroll ${label} ${back ? "left" : "right"}`}
        onPress={() => scrollBy(back ? -STEP : STEP)}
        color={primaryColor}
        size="md"
        style={[styles.arrow, { backgroundColor: colors.card, borderColor: primaryColor }]}
      />
    </View>
  );

  return (
    <View style={styles.wrapper} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        // `role`, not `accessibilityRole`: "group" is an ARIA role with no React Native
        // equivalent, and it is what tells a screen reader this row is one thing with a
        // name. Same call the time picker makes with role="radiogroup".
        role="group"
        accessibilityLabel={label}
        accessibilityHint={scrollable ? "Scrolls horizontally" : undefined}
        scrollEventThrottle={16}
        onScroll={(e) => {
          setOffset(e.nativeEvent.contentOffset.x);
          onScroll?.(e);
        }}
        onContentSizeChange={(w) => setContentWidth(w)}
        style={style}
        contentContainerStyle={contentContainerStyle}
        // react-native-web renders no tabindex of its own, so a scroller whose contents
        // aren't focusable can be neither reached nor scrolled from the keyboard.
        {...(keyboardFocusable && Platform.OS === "web" ? ({ tabIndex: 0 } as object) : null)}
        {...rest}
      >
        {children}
      </ScrollView>

      {scrollButtons && canScrollBack && scrollButton(true)}
      {scrollButtons && canScrollOn && scrollButton(false)}
    </View>
  );
}
