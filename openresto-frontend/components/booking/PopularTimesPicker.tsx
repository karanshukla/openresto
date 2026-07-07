import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import { ThemedText } from "../themed-text";
import { TimeSlotDto } from "@/api/availability";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Ionicons } from "@expo/vector-icons";
import { getNowInTimezone } from "@/utils/date";
import * as Haptics from "expo-haptics";

interface PopularTimesPickerProps {
  slots: TimeSlotDto[];
  selectedTime: string;
  onSelectTime: (time: string) => void;
  selectedDate?: string;
  timezone?: string;
}

type Category = "Lunch" | "Dinner" | "All";

export default function PopularTimesPicker({
  slots,
  selectedTime,
  onSelectTime,
  selectedDate,
  timezone,
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

  const showLeftArrow = scrollPos > 15;
  const showRightArrow =
    contentWidth > containerWidth && scrollPos < contentWidth - containerWidth - 15;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {categories.map((cat) => {
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
        })}
      </View>

      <View
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
          {filteredSlots.length === 0 ? (
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
          )}
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
            <Pressable
              testID="scroll-left-arrow"
              onPress={() => scrollBy(-180)}
              style={({ pressed }) => [
                styles.arrowCircle,
                { backgroundColor: colors.card, borderColor: PRIMARY },
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
            >
              <Ionicons name="chevron-back" size={16} color={PRIMARY} />
            </Pressable>
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
            <Pressable
              testID="scroll-right-arrow"
              onPress={() => scrollBy(180)}
              style={({ pressed }) => [
                styles.arrowCircle,
                { backgroundColor: colors.card, borderColor: PRIMARY },
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
            >
              <Ionicons name="chevron-forward" size={16} color={PRIMARY} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    width: "100%",
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabDisabled: {
    opacity: 0.35,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextDisabled: {
    opacity: 0.6,
  },
  scrollWrapper: {
    position: "relative",
    width: "100%",
    minHeight: 65,
  },
  slotsScroll: {
    width: "100%",
  },
  slotsContainer: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  scrollIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  leftIndicator: {
    left: 0,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  rightIndicator: {
    right: 0,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  slotChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 70,
    alignItems: "center",
    elevation: 1,
  },
  slotText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.6,
    fontStyle: "italic",
    paddingVertical: 12,
  },
});
