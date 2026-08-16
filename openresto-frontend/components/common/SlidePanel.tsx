import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/hooks/use-app-theme";
import { animateNode, EASE_ENTER, prefersReducedMotion } from "@/utils/webAnimation";
import {
  shouldDismissSheet,
  SHEET_EXIT_DISTANCE,
  SIDE_ENTER_DISTANCE,
  SIDE_ENTER_MS,
} from "@/utils/panelMotion";
import { styles } from "./SlidePanel.styles";

interface SlidePanelProps {
  variant: "side" | "sheet";
  /** Fires once the sheet has finished animating away — a drag past threshold, a flick, or a
   * backdrop tap. The side variant never dismisses itself; it just stays mounted showing
   * whatever the caller renders into it. */
  onDismiss: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  testID?: string;
}

/**
 * Side panel on wide layouts, bottom sheet on compact — the same chrome BookingDrawer built
 * for the booking form, generalized so the lookup result panel can inherit the entrance
 * animation and the drag-to-dismiss sheet instead of reimplementing them. Unlike
 * BookingDrawer, the side variant here isn't a modal-ish overlay with its own close button:
 * it's a persistent second column that always shows the latest lookup outcome, so only the
 * sheet — which covers the form it's dismissing back to — needs dismiss handling at all.
 */
export default function SlidePanel({
  variant,
  onDismiss,
  accessibilityLabel,
  children,
  testID = "result-panel",
}: SlidePanelProps) {
  const { colors, isDark } = useAppTheme();

  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const dragY = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissSheet(g.dy, g.vy)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Animated.timing(dragY, {
              toValue: SHEET_EXIT_DISTANCE,
              duration: prefersReducedMotion() ? 0 : 180,
              useNativeDriver: false,
            }).start(({ finished }) => finished && onDismissRef.current());
          } else {
            Animated.spring(dragY, { toValue: 0, bounciness: 0, useNativeDriver: false }).start();
          }
        },
      }),
    [dragY]
  );

  useEffect(() => () => dragY.stopAnimation(), [dragY]);

  // Entrance plays once, the moment the panel mounts (the transition out of idle) — it
  // stays mounted across later lookups, so a second search doesn't replay the slide-in.
  const sideRef = useRef<View>(null);
  useLayoutEffect(() => {
    if (variant !== "side") return;
    animateNode(
      sideRef.current,
      [
        { opacity: 0, transform: `translateX(${SIDE_ENTER_DISTANCE}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: SIDE_ENTER_MS, easing: EASE_ENTER }
    );
  }, [variant]);

  const dismissWithHaptic = useCallback(() => {
    Haptics.selectionAsync();
    Animated.timing(dragY, {
      toValue: SHEET_EXIT_DISTANCE,
      duration: prefersReducedMotion() ? 0 : 180,
      useNativeDriver: false,
    }).start(({ finished }) => finished && onDismissRef.current());
  }, [dragY]);

  if (variant === "sheet") {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={dismissWithHaptic}>
        <View style={styles.sheetRoot}>
          <Pressable
            testID={`${testID}-backdrop`}
            accessibilityRole="button"
            accessibilityLabel={`Close ${accessibilityLabel}`}
            style={[styles.backdrop, { backgroundColor: colors.overlay }]}
            onPress={dismissWithHaptic}
          />
          <Animated.View
            testID={testID}
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderTopColor: colors.border },
              { transform: [{ translateY: dragY }] },
            ]}
          >
            <View
              {...panResponder.panHandlers}
              testID={`${testID}-grabber`}
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.grabberArea}
            >
              <View
                style={[
                  styles.grabber,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.18)" },
                ]}
              />
            </View>
            <View style={styles.sheetBody}>{children}</View>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  return (
    <View ref={sideRef} testID={testID} accessibilityLabel={accessibilityLabel} style={styles.side}>
      {children}
    </View>
  );
}
