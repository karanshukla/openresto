import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/utils/haptics";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";
import { animateNode, EASE_ENTER, prefersReducedMotion } from "@/utils/webAnimation";
import {
  shouldClaimSheetDrag,
  shouldDismissSheet,
  SHEET_EXIT_DISTANCE,
  SIDE_ENTER_DISTANCE,
  SIDE_ENTER_MS,
} from "@/utils/panelMotion";
import NativeSheet from "@/components/common/NativeSheet";
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
 * The sheet is bottom-anchored, so without this its last row sits under the home indicator. A
 * spacer rather than padding on the sheet because the inset has to be read inside the Modal's
 * own safe-area provider, which is the one that knows the window's edge rather than the tab's.
 *
 * @see [SlidePanel.test.tsx](../../tests/components/common/SlidePanel.test.tsx) — pins that the
 * sheet clears the bottom safe area off web and adds nothing on it.
 */
function SheetBottomInset({ testID }: { testID: string }) {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") return null;
  return <View testID={testID} style={{ height: insets.bottom }} />;
}

/**
 * Side panel on wide layouts, bottom sheet on compact — the same chrome BookingDrawer built
 * for the booking form, generalized so the lookup result panel can inherit the entrance
 * animation and the drag-to-dismiss sheet instead of reimplementing them. Unlike
 * BookingDrawer, the side variant here isn't a modal-ish overlay with its own close button:
 * it's a persistent second column that always shows the latest lookup outcome, so only the
 * sheet — which covers the form it's dismissing back to — needs dismiss handling at all.
 *
 * @see [SlidePanel.test.tsx](../../tests/components/common/SlidePanel.test.tsx) — pins that the
 * sheet clears the bottom safe area off web and adds nothing on it.
 */
export default function SlidePanel({
  variant,
  onDismiss,
  accessibilityLabel,
  children,
  testID = "result-panel",
}: SlidePanelProps) {
  const { colors, isDark } = useAppTheme();
  const { t } = useTranslation();

  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const dragY = useRef(new Animated.Value(0)).current;
  const nativeDriver = Platform.OS !== "web";
  /**
   * Whether the body is scrolled to its top, which is what decides who owns a downward drag.
   * A sheet that can only be dragged by its handle reads as a sheet that cannot be dragged:
   * the card is the part under the thumb.
   */
  const bodyAtTop = useRef(true);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        /**
         * Claimed ahead of the body's own scroller, but only where the scroller has nothing
         * left to give: at the top of the content, dragging down. Anywhere else this stays out
         * of the way and the list scrolls, which is why the gate is the scroll position and not
         * the gesture alone.
         */
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          shouldClaimSheetDrag(g.dy, g.dx, bodyAtTop.current),
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissSheet(g.dy, g.vy)) {
            haptics.press();
            Animated.timing(dragY, {
              toValue: SHEET_EXIT_DISTANCE,
              duration: prefersReducedMotion() ? 0 : 180,
              useNativeDriver: nativeDriver,
            }).start(({ finished }) => finished && onDismissRef.current());
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              bounciness: 0,
              useNativeDriver: nativeDriver,
            }).start();
          }
        },
      }),
    [dragY, nativeDriver]
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
    haptics.selection();
    Animated.timing(dragY, {
      toValue: SHEET_EXIT_DISTANCE,
      duration: prefersReducedMotion() ? 0 : 180,
      useNativeDriver: nativeDriver,
    }).start(({ finished }) => finished && onDismissRef.current());
  }, [dragY, nativeDriver]);

  /**
   * Off web the sheet is the platform's own. The hand-rolled `Modal` + `PanResponder` below
   * does not drag on a device at all — not by its body and not by its handle — so the panel
   * shipped with the backdrop as the only way out. That machinery stays for the website, which
   * has no platform sheet to defer to; everything the sheet needs on a phone (the drag, the
   * rubber band, the handle, the backdrop) is the system's.
   */
  if (variant === "sheet" && Platform.OS !== "web") {
    return (
      <NativeSheet
        accessibilityLabel={accessibilityLabel}
        onDismiss={onDismiss}
        testID={`${testID}-body`}
      >
        {children}
      </NativeSheet>
    );
  }

  if (variant === "sheet") {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={dismissWithHaptic}>
        {/* Its own provider: a Modal covers the whole window, tab bar included, so the inset
            it steps over is the window's home indicator and not the tab's bar. The page
            underneath sits inside a tab, whose insets include that bar (GuestTabStack). */}
        <SafeAreaProvider>
          <View style={styles.sheetRoot}>
            <Pressable
              testID={`${testID}-backdrop`}
              accessibilityRole="button"
              accessibilityLabel={t("common.slidePanel.closeLabel", { label: accessibilityLabel })}
              style={[styles.backdrop, { backgroundColor: colors.overlay }]}
              onPress={dismissWithHaptic}
            />
            <Animated.View
              {...panResponder.panHandlers}
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
              {/* Scrollable, not a plain View: the sheet is capped at a fraction of the
                viewport and clips its overflow, so a booking taller than that cap loses
                everything past the fold with no way to reach it. */}
              <ScrollView
                testID={`${testID}-body`}
                style={styles.sheetScroll}
                contentContainerStyle={styles.sheetBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onScroll={(e) => {
                  bodyAtTop.current = e.nativeEvent.contentOffset.y <= 0;
                }}
                scrollEventThrottle={16}
              >
                {children}
              </ScrollView>
              <SheetBottomInset testID={`${testID}-bottom-inset`} />
            </Animated.View>
          </View>
        </SafeAreaProvider>
      </Modal>
    );
  }

  return (
    <View ref={sideRef} testID={testID} accessibilityLabel={accessibilityLabel} style={styles.side}>
      {children}
    </View>
  );
}
