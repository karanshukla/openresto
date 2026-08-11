import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing } from "react-native";
import { usePathname } from "expo-router";
import { styles } from "./RouteTransition.styles";

const DURATION_MS = 140;
/** How far the incoming view rises as it settles. */
const RISE = 6;
/**
 * The fade never reaches zero. Nothing is crossfading here — the outgoing view is gone
 * before the incoming one mounts — so a transparent frame shows the flat page background
 * across the whole viewport, which reads as the screen blinking rather than as one view
 * replacing another. Starting close to opaque keeps the movement without the blink.
 */
const START_OPACITY = 0.88;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

/**
 * Lifts route content into place whenever the path changes. On web the user layout
 * renders a bare `<Slot />`, so moving between the home page, the locations list and a
 * booking confirmation is a hard cut with no sense of one view replacing another.
 *
 * Keyed off the pathname rather than the rendered children: query-string changes
 * (`?time=19:30`) land on the same view and should not replay the transition. The first
 * paint is exempt too — a cold load has no previous view to replace, and animating it
 * only delays the content the visitor came for.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const anim = useRef(new Animated.Value(1)).current;
  const isFirstPaint = useRef(true);

  useEffect(() => {
    if (isFirstPaint.current) {
      isFirstPaint.current = false;
      return;
    }
    if (prefersReducedMotion()) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [pathname, anim]);

  return (
    <Animated.View
      testID="route-transition"
      style={[
        styles.root,
        {
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [START_OPACITY, 1] }),
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
