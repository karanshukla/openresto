import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import { ThemedText } from "../themed-text";
import { TimeSlotDto } from "@/api/availability";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconButton } from "@/components/common/IconButton";
import { getNowInTimezone } from "@/utils/date";
import * as Haptics from "expo-haptics";
import { styles } from "./PopularTimesPicker.styles";

interface PopularTimesPickerProps {
  slots: TimeSlotDto[];
  selectedTime: string;
  onSelectTime: (time: string) => void;
  selectedDate?: string;
  timezone?: string;
  /**
   * Wrap the chips onto multiple rows instead of scrolling them horizontally. The
   * booking drawer is only 460px wide, where the scroller's overlay arrow lands on
   * top of the last chip and hides half the times behind a swipe.
   */
  wrap?: boolean;
}

type Category = "Lunch" | "Dinner" | "All";

export default function PopularTimesPicker({
  slots,
  selectedTime,
  onSelectTime,
  selectedDate,
  timezone,
  wrap = false,
}: PopularTimesPickerProps) {
  const { colors, isDark, primaryColor: PRIMARY } = useAppTheme();
  const [activeCategory, setActiveCategory] = useState<Category>("Lunch");

  const scrollRef = useRef<ScrollView>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const categories: Category[] = ["Lunch", "Dinner", "All"];

  // For today's date, strip out slots whose time has already passed.
  const slotsInView = useMemo(() => {
    if (!slots?.length || !selectedDate || !timezone) return slots ?? [];
    const { dateStr: todayStr, hours, minutes } = getNowInTimezone(timezone);
    if (selectedDate !== todayStr) return slots;
    const nowMins = hours * 60 + minutes;
    return slots.filter((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + m >= nowMins - 5;
    });
  }, [slots, selectedDate, timezone]);

  const filteredSlots = useMemo(() => {
    const available = slotsInView.filter((s) => s.isAvailable);
    if (activeCategory === "All") return available;
    return available.filter((s) => s.category === activeCategory);
  }, [slotsInView, activeCategory]);

  // A category tab is disabled when it's today and the entire meal period has already passed.
  const isCategoryDisabled = (cat: Category): boolean => {
    if (cat === "All") return false;
    if (!selectedDate || !timezone) return false;
    const { dateStr: todayStr } = getNowInTimezone(timezone);
    if (selectedDate !== todayStr) return false;
    return !slotsInView.some((s) => s.category === cat);
  };

  // If the active category has no available slots but others do, fall back to 'All'.
  useEffect(() => {
    const hasAvailableInCategory = slotsInView.some(
      (s) => s.isAvailable && s.category === activeCategory
    );
    if (
      !hasAvailableInCategory &&
      activeCategory !== "All" &&
      slotsInView.some((s) => s.isAvailable)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveCategory("All");
    }
  }, [slotsInView, activeCategory]);

  // Web-specific: Mouse Wheel and Drag-to-scroll — only runs when Platform.OS === "web"
  /* istanbul ignore next */
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // @ts-ignore
    const node = scrollRef.current?.getScrollableNode?.();
    if (!node) return;

    // 1. Mouse Wheel -> Horizontal Scroll
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        node.scrollLeft += e.deltaY;
        e.preventDefault();
        setScrollPos(node.scrollLeft);
      }
    };

    // 2. Click and Drag
    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    const onMouseDown = (e: MouseEvent) => {
      isDown = true;
      startX = e.pageX - node.offsetLeft;
      scrollLeft = node.scrollLeft;
      node.classList.add("grabbing");
    };
    const onMouseLeave = () => {
      isDown = false;
      node.classList.remove("grabbing");
    };
    const onMouseUp = () => {
      isDown = false;
      node.classList.remove("grabbing");
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - node.offsetLeft;
      const walk = (x - startX) * 2;
      node.scrollLeft = scrollLeft - walk;
      setScrollPos(node.scrollLeft);
    };

    node.classList.add("grab-scroll");
    node.addEventListener("wheel", handleWheel, { passive: false });
    node.addEventListener("mousedown", onMouseDown);
    node.addEventListener("mouseleave", onMouseLeave);
    node.addEventListener("mouseup", onMouseUp);
    node.addEventListener("mousemove", onMouseMove);

    return () => {
      node.removeEventListener("wheel", handleWheel);
      node.removeEventListener("mousedown", onMouseDown);
      node.removeEventListener("mouseleave", onMouseLeave);
      node.removeEventListener("mouseup", onMouseUp);
      node.removeEventListener("mousemove", onMouseMove);
      node.classList.remove("grab-scroll", "grabbing");
    };
  }, [activeCategory]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollPos(event.nativeEvent.contentOffset.x);
  };

  const scrollBy = (offset: number) => {
    scrollRef.current?.scrollTo({ x: scrollPos + offset, animated: true });
  };

  const showLeftArrow = !wrap && scrollPos > 15;
  const showRightArrow =
    !wrap && contentWidth > containerWidth && scrollPos < contentWidth - containerWidth - 15;

  const categoryTabs = categories.map((cat) => {
    const isActive = activeCategory === cat;
    const disabled = isCategoryDisabled(cat);
    return (
      <Pressable
        key={cat}
        onPress={() => {
          if (!disabled) {
            Haptics.selectionAsync();
            setActiveCategory(cat);
          }
        }}
        disabled={disabled}
        accessibilityRole="tab"
        accessibilityLabel={cat}
        accessibilityState={{ selected: isActive, disabled }}
        style={[
          styles.tab,
          { borderColor: colors.border },
          isActive && { backgroundColor: PRIMARY, borderColor: PRIMARY },
          disabled && styles.tabDisabled,
        ]}
      >
        <ThemedText
          style={[
            styles.tabText,
            isActive && { color: "#fff" },
            disabled && styles.tabTextDisabled,
          ]}
        >
          {cat}
        </ThemedText>
      </Pressable>
    );
  });

  const slotChips =
    filteredSlots.length === 0 ? (
      <ThemedText style={styles.emptyText}>No slots available for this period.</ThemedText>
    ) : (
      filteredSlots.map((slot) => {
        const isSelected = selectedTime === slot.time;
        return (
          <Pressable
            key={slot.time}
            onPress={() => {
              Haptics.selectionAsync();
              onSelectTime(slot.time);
            }}
            accessibilityRole="radio"
            accessibilityLabel={slot.time}
            accessibilityState={{ checked: isSelected, selected: isSelected }}
            style={[
              styles.slotChip,
              { borderColor: colors.border, backgroundColor: isDark ? "#1e1e1e" : "#fff" },
              isSelected && {
                backgroundColor: PRIMARY,
                borderColor: PRIMARY,
              },
            ]}
          >
            <ThemedText style={[styles.slotText, isSelected && { color: "#fff" }]}>
              {slot.time}
            </ThemedText>
          </Pressable>
        );
      })
    );

  if (wrap) {
    return (
      <View style={styles.container}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {categoryTabs}
        </View>
        <View style={styles.wrappedSlots} role="radiogroup" accessibilityLabel="Available times">
          {slotChips}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {categoryTabs}
      </View>

      <View
        role="radiogroup"
        accessibilityLabel="Available times"
        style={styles.scrollWrapper}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.slotsScroll}
          contentContainerStyle={styles.slotsContainer}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={(w) => setContentWidth(w)}
        >
          {slotChips}
        </ScrollView>

        {showLeftArrow && (
          <View
            pointerEvents="box-none"
            style={[
              styles.scrollIndicator,
              styles.leftIndicator,
              { backgroundColor: colors.page + "99" },
            ]}
          >
            <IconButton
              testID="scroll-left-arrow"
              name="chevron-back"
              accessibilityLabel="Show earlier times"
              onPress={() => scrollBy(-180)}
              color={PRIMARY}
              size="md"
              style={[styles.arrowCircle, { backgroundColor: colors.card, borderColor: PRIMARY }]}
            />
          </View>
        )}

        {showRightArrow && (
          <View
            pointerEvents="box-none"
            style={[
              styles.scrollIndicator,
              styles.rightIndicator,
              { backgroundColor: colors.page + "99" },
            ]}
          >
            <IconButton
              testID="scroll-right-arrow"
              name="chevron-forward"
              accessibilityLabel="Show later times"
              onPress={() => scrollBy(180)}
              color={PRIMARY}
              size="md"
              style={[styles.arrowCircle, { backgroundColor: colors.card, borderColor: PRIMARY }]}
            />
          </View>
        )}
      </View>
    </View>
  );
}
